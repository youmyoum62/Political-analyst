from datetime import date

from pydantic import BaseModel, ConfigDict


class PoliticianListItem(BaseModel):
    id: int
    name: str
    party: str
    house: str


class PoliticianDetail(BaseModel):
    id: int
    name: str
    party: str
    house: str
    district: str
    term_start: date | None
    term_end: date | None
    final_score: float


class RankingItem(BaseModel):
    politician_id: int
    rank: int
    name: str
    party: str
    final_score: float
    trend: int


class AnalysisDetail(BaseModel):
    politician_id: int
    activity_score: float
    question_quality_score: float
    legislative_score: float
    influence_score: float
    policy_impact_score: float
    final_score: float


class HealthResponse(BaseModel):
    status: str


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
