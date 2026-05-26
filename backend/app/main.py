import logging
import os
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
from app.middleware import RequestLoggingMiddleware
from app.repositories import AdminRepository, PoliticianRepository
from app.schemas import (
    AnalysisDetail,
    HealthResponse,
    IngestionRunItem,
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

log = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────────────
# DB初期化（旧スキーマ検出時はリセット）
# ────────────────────────────────────────────────────────────────────────────

def _ensure_schema() -> None:
    insp = sa_inspect(engine)
    if insp.has_table("politicians"):
        cols = {c["name"] for c in insp.get_columns("politicians")}
        if "role_profile" not in cols:
            # 旧スキーマ（role_profile カラムなし）を検出 → 全テーブルを再作成
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

app = FastAPI(
    title="Political Score API",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(RequestLoggingMiddleware)

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
    return HealthResponse(
        status="ok" if db_status == "connected" else "degraded",
        db=db_status,
        politicians_count=count,
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
    if creds.credentials != _ADMIN_TOKEN:
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


app.include_router(admin)
