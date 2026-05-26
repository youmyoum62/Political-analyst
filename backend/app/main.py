import os
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine, get_db
from app.repositories import PoliticianRepository
from app.schemas import (
    AnalysisDetail,
    HealthResponse,
    PaginatedResponse,
    PoliticianDetail,
    PoliticianListItem,
    RankingItem,
)
from app.seed import seed_if_empty
from app.services import PoliticianService


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

app = FastAPI(
    title="Political Score API",
    version="1.0.0",
    lifespan=lifespan,
)

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
def health() -> HealthResponse:
    return HealthResponse(status="ok")


# ────────────────────────────────────────────────────────────────────────────
# v1 ルーター
# ────────────────────────────────────────────────────────────────────────────

v1 = APIRouter(prefix="/v1")


@v1.get("/politicians", response_model=PaginatedResponse[PoliticianListItem])
def list_politicians(
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
def politician_detail(
    politician_id: int, db: Session = Depends(get_db)
) -> PoliticianDetail:
    service = PoliticianService(PoliticianRepository(db))
    data = service.politician_detail(politician_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Politician not found")
    return data


@v1.get("/ranking", response_model=list[RankingItem])
def ranking(db: Session = Depends(get_db)) -> list[RankingItem]:
    service = PoliticianService(PoliticianRepository(db))
    return service.ranking()


@v1.get("/analysis/{politician_id}", response_model=AnalysisDetail)
def analysis(politician_id: int, db: Session = Depends(get_db)) -> AnalysisDetail:
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
