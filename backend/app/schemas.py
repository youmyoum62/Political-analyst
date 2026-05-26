from datetime import date
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
    has_next: bool


class HealthResponse(BaseModel):
    status: str


class PartyItem(BaseModel):
    id: int
    name_ja: str
    abbreviation: Optional[str] = None


class PoliticianListItem(BaseModel):
    id: int
    name: str
    party: str
    house: str
    role_profile: str


class PoliticianDetail(BaseModel):
    id: int
    name: str
    party: str
    house: str
    district: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    role_profile: str
    term_start: Optional[date]
    term_end: Optional[date]
    top_question: Optional[str]
    key_achievement: Optional[str]
    summary: Optional[str]
    participation_score: float
    quality_score: float
    legislative_score: float
    policy_impact_score: float
    influence_score: float
    final_score: float


class RankingItem(BaseModel):
    politician_id: int
    rank: int
    name: str
    party: str
    house: str
    district: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    role_profile: str
    top_question: Optional[str]
    key_achievement: Optional[str]
    summary: Optional[str]
    participation_score: float
    quality_score: float
    legislative_score: float
    policy_impact_score: float
    influence_score: float
    final_score: float
    trend: int


class AnalysisDetail(BaseModel):
    politician_id: int
    role_profile: str
    participation_score: float
    quality_score: float
    legislative_score: float
    policy_impact_score: float
    influence_score: float
    final_score: float
    # 役割プロファイルの重みを返すことで透明性を確保
    weights: dict[str, float]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
