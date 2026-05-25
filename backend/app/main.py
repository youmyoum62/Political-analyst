from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.repositories import PoliticianRepository
from app.schemas import AnalysisDetail, HealthResponse, PoliticianDetail, PoliticianListItem, RankingItem
from app.seed import seed_if_empty
from app.services import PoliticianService

app = FastAPI(title='Political Score API', version='0.1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.on_event('startup')
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed_if_empty(db)


@app.get('/health', response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status='ok')


@app.get('/politicians', response_model=list[PoliticianListItem])
def list_politicians(db: Session = Depends(get_db)) -> list[PoliticianListItem]:
    service = PoliticianService(PoliticianRepository(db))
    return service.list_politicians()


@app.get('/politicians/{politician_id}', response_model=PoliticianDetail)
def politician_detail(politician_id: int, db: Session = Depends(get_db)) -> PoliticianDetail:
    service = PoliticianService(PoliticianRepository(db))
    data = service.politician_detail(politician_id)
    if data is None:
        raise HTTPException(status_code=404, detail='Politician not found')
    return data


@app.get('/ranking', response_model=list[RankingItem])
def ranking(db: Session = Depends(get_db)) -> list[RankingItem]:
    service = PoliticianService(PoliticianRepository(db))
    return service.ranking()


@app.get('/analysis/{politician_id}', response_model=AnalysisDetail)
def analysis(politician_id: int, db: Session = Depends(get_db)) -> AnalysisDetail:
    service = PoliticianService(PoliticianRepository(db))
    data = service.analysis(politician_id)
    if data is None:
        raise HTTPException(status_code=404, detail='Analysis not found')
    return data
