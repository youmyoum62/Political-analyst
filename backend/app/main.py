import logging
import os
import secrets
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine, get_db
from app.logging_config import configure_logging
from app.middleware import RequestLoggingMiddleware
from app.repositories import AdminRepository, PoliticianRepository
from app.schemas import (
    ActivityItem,
    AnalysisDetail,
    HealthResponse,
    IngestionRunItem,
    IngestTriggerRequest,
    IngestTriggerResponse,
    PaginatedResponse,
    PoliticianDetail,
    PoliticianListItem,
    RankingItem,
    ScoreHistoryPoint,
    SnapshotTriggerRequest,
    SnapshotTriggerResponse,
)
from app.seed import seed_if_empty
from app.services import PoliticianService

configure_logging()
log = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────────────
# DB初期化（旧スキーマ検出時はリセット）
# ────────────────────────────────────────────────────────────────────────────

def _ensure_schema() -> None:
    if not engine.url.drivername.startswith("sqlite"):
        # PostgreSQL: alembic が管理するが、マイグレーション漏れの安全網として create_all も実行
        Base.metadata.create_all(bind=engine, checkfirst=True)
        return
    insp = sa_inspect(engine)
    if insp.has_table("politicians"):
        cols = {c["name"] for c in insp.get_columns("politicians")}
        if "role_profile" not in cols:
            Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_schema()
    with SessionLocal() as db:
        seed_if_empty(db)
    yield


# ────────────────────────────────────────────────────────────────────────────
# アプリケーション設定
# ────────────────────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)

# 本番では OpenAPI ドキュメント（/docs, /redoc, /openapi.json）を無効化し
# 管理エンドポイント仕様の事前開示を防ぐ。
_APP_ENV = os.getenv("APP_ENV", "development").lower()
_DOCS_ENABLED = _APP_ENV != "production"

app = FastAPI(
    title="Political Score API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _DOCS_ENABLED else None,
    redoc_url="/redoc" if _DOCS_ENABLED else None,
    openapi_url="/openapi.json" if _DOCS_ENABLED else None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(RequestLoggingMiddleware)

# Host ヘッダ検証（任意）。ALLOWED_HOSTS が設定された場合のみ有効化する。
_allowed_hosts = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]
if _allowed_hosts:
    from fastapi.middleware.trustedhost import TrustedHostMiddleware

    app.add_middleware(TrustedHostMiddleware, allowed_hosts=_allowed_hosts)

# CORS: 環境変数で許可オリジンを指定（デフォルトは localhost:3000 のみ）
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,       # Cookie不使用のためFalse
    allow_methods=["GET"],         # 読み取り専用API
    allow_headers=["Content-Type", "Accept"],
)


# ────────────────────────────────────────────────────────────────────────────
# ヘルスチェック（バージョニングなし）
# ────────────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    try:
        from sqlalchemy import text as sa_text
        db.execute(sa_text("SELECT 1"))
        db_status = "connected"
        from sqlalchemy import func as sa_func
        from sqlalchemy import select as sa_select

        from app.models import Politician
        count = db.scalar(sa_select(sa_func.count()).select_from(Politician)) or 0
    except Exception:
        db_status = "error"
        count = 0

    # データ鮮度: 最新インジェスト実行の時刻とステータスを露出する
    last_ingest_at = None
    last_ingest_status = None
    try:
        runs = AdminRepository(db).list_ingestion_runs(limit=1)
        if runs:
            r = runs[0]
            ts = r.finished_at or r.started_at
            last_ingest_at = ts.isoformat() if ts else None
            last_ingest_status = r.status
    except Exception:
        pass

    return HealthResponse(
        status="ok" if db_status == "connected" else "degraded",
        db=db_status,
        politicians_count=count,
        last_ingest_at=last_ingest_at,
        last_ingest_status=last_ingest_status,
    )


# ────────────────────────────────────────────────────────────────────────────
# v1 ルーター
# ────────────────────────────────────────────────────────────────────────────

v1 = APIRouter(prefix="/v1")


@v1.get("/politicians", response_model=PaginatedResponse[PoliticianListItem])
@limiter.limit("60/minute")
def list_politicians(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedResponse[PoliticianListItem]:
    service = PoliticianService(PoliticianRepository(db))
    items, total = service.list_politicians(limit=limit, offset=offset)
    return PaginatedResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_next=offset + limit < total,
    )


@v1.get("/politicians/{politician_id}", response_model=PoliticianDetail)
@limiter.limit("60/minute")
def politician_detail(
    request: Request, politician_id: int, db: Session = Depends(get_db)
) -> PoliticianDetail:
    service = PoliticianService(PoliticianRepository(db))
    data = service.politician_detail(politician_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Politician not found")
    return data


@v1.get("/ranking", response_model=list[RankingItem])
@limiter.limit("30/minute")
def ranking(request: Request, db: Session = Depends(get_db)) -> list[RankingItem]:
    service = PoliticianService(PoliticianRepository(db))
    return service.ranking()


@v1.get("/politicians/{politician_id}/score-history", response_model=list[ScoreHistoryPoint])
@limiter.limit("60/minute")
def score_history(
    request: Request, politician_id: int, db: Session = Depends(get_db)
) -> list[ScoreHistoryPoint]:
    repo = PoliticianRepository(db)
    if not repo.get_politician(politician_id):
        raise HTTPException(status_code=404, detail="Politician not found")
    rows = repo.get_score_history(politician_id)
    return [
        ScoreHistoryPoint(
            period_start=sc.period_start,
            period_end=sc.period_end,
            final_score=score.final_score,
            rank_snapshot=score.rank_snapshot,
            computed_at=sc.computed_at.isoformat(),
        )
        for sc, score in rows
    ]


@v1.get("/politicians/{politician_id}/activities", response_model=list[ActivityItem])
@limiter.limit("60/minute")
def politician_activities(
    request: Request,
    politician_id: int,
    limit: int = Query(default=5, ge=1, le=20),
    type: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ActivityItem]:
    repo = PoliticianRepository(db)
    if not repo.get_politician(politician_id):
        raise HTTPException(status_code=404, detail="Politician not found")
    service = PoliticianService(repo)
    return service.get_activities(politician_id=politician_id, limit=limit, activity_type=type)


@v1.get("/analysis/{politician_id}", response_model=AnalysisDetail)
@limiter.limit("30/minute")
def analysis(request: Request, politician_id: int, db: Session = Depends(get_db)) -> AnalysisDetail:
    service = PoliticianService(PoliticianRepository(db))
    data = service.analysis(politician_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return data


app.include_router(v1)


# ────────────────────────────────────────────────────────────────────────────
# 後方互換: /ranking → /v1/ranking へリダイレクト
# ────────────────────────────────────────────────────────────────────────────

@app.get("/ranking", include_in_schema=False)
def ranking_compat(db: Session = Depends(get_db)) -> list[RankingItem]:
    service = PoliticianService(PoliticianRepository(db))
    return service.ranking()


# ────────────────────────────────────────────────────────────────────────────
# 管理者 API（Bearer token 認証）
# ────────────────────────────────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=True)
_ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")


def _require_admin(creds: HTTPAuthorizationCredentials = Security(_bearer)) -> None:
    if not _ADMIN_TOKEN:
        raise HTTPException(status_code=503, detail="Admin API is disabled (ADMIN_TOKEN not set)")
    # タイミング攻撃を避けるため定数時間比較を用いる
    if not secrets.compare_digest(creds.credentials, _ADMIN_TOKEN):
        raise HTTPException(status_code=403, detail="Invalid admin token")


admin = APIRouter(prefix="/admin", tags=["admin"])


@admin.get("/ingestion-runs", response_model=list[IngestionRunItem])
def list_ingestion_runs(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin),
) -> list[IngestionRunItem]:
    runs = AdminRepository(db).list_ingestion_runs(limit=limit)
    return [
        IngestionRunItem(
            id=r.id,
            source_name=r.source_name,
            started_at=r.started_at.isoformat() if r.started_at else None,
            finished_at=r.finished_at.isoformat() if r.finished_at else None,
            status=r.status,
            records_seen=r.records_seen,
            records_inserted=r.records_inserted,
            records_updated=r.records_updated,
            records_failed=r.records_failed,
            error_summary=r.error_summary,
        )
        for r in runs
    ]


@admin.post("/snapshot/trigger", response_model=SnapshotTriggerResponse)
def trigger_snapshot(
    body: SnapshotTriggerRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin),
) -> SnapshotTriggerResponse:
    from app.scoring.snapshot import recompute_snapshot
    try:
        written = recompute_snapshot(
            db, period_start=body.period_start, period_end=body.period_end
        )
    except Exception as exc:
        log.error("snapshot trigger failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

    return SnapshotTriggerResponse(
        written=written,
        period_start=body.period_start,
        period_end=body.period_end,
        message=f"{written} 件のスナップショットを書き込みました",
    )


@admin.post("/ingest/trigger", response_model=IngestTriggerResponse)
def trigger_ingest(
    body: IngestTriggerRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin),
) -> IngestTriggerResponse:
    from app.ingest.pipeline import run_ingest
    try:
        result = run_ingest(
            db,
            period_start=body.period_start,
            period_end=body.period_end,
            max_records_per_house=body.max_records_per_house,
        )
    except Exception as exc:
        log.error("ingest trigger failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    return IngestTriggerResponse(**result)


@admin.delete("/seed-data", response_model=dict)
def clear_seed_data(
    confirm: bool = Query(default=False),
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin),
) -> dict:
    """
    external_ref が NULL の議員（シードデモデータ）を削除する。

    本番実データ誤削除を防ぐため:
      - confirm=true を付けない限り削除せず dry-run（対象件数とサンプルを返す）。
      - 対象が想定シード件数（10件）を超える場合は force=true がない限り 409 で中止。
    """
    from sqlalchemy import text

    SEED_EXPECTED_MAX = 10  # seed.py が投入するデモ議員数の上限

    rows = db.execute(
        text("SELECT id, name FROM politicians WHERE external_ref IS NULL ORDER BY id")
    ).fetchall()
    matched = len(rows)
    sample = [{"id": r[0], "name": r[1]} for r in rows[:20]]

    if not confirm:
        return {
            "dry_run": True,
            "matched": matched,
            "sample": sample,
            "message": (
                f"{matched}件が削除対象（external_ref IS NULL）。"
                "実削除するには confirm=true を付与してください。"
            ),
        }

    if matched > SEED_EXPECTED_MAX and not force:
        raise HTTPException(
            status_code=409,
            detail=(
                f"削除対象が{matched}件で想定シード上限{SEED_EXPECTED_MAX}件を超えています。"
                "本番実データの誤削除を防ぐため中止しました。"
                "意図的な場合は force=true を付与してください。"
            ),
        )

    result = db.execute(text("DELETE FROM politicians WHERE external_ref IS NULL"))
    db.commit()
    return {"dry_run": False, "deleted_politicians": result.rowcount}


app.include_router(admin)
