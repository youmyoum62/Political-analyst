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
    rank: Optional[int] = None
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


class HealthResponse(BaseModel):
    status: str
    db: str = "unknown"
    politicians_count: int = 0


class ScoreHistoryPoint(BaseModel):
    period_start: date
    period_end: date
    final_score: float
    rank_snapshot: Optional[int]
    computed_at: str


class IngestionRunItem(BaseModel):
    id: int
    source_name: str
    started_at: Optional[str]
    finished_at: Optional[str]
    status: str
    records_seen: int
    records_inserted: int
    records_updated: int
    records_failed: int
    error_summary: Optional[str]


class SnapshotTriggerRequest(BaseModel):
    period_start: date
    period_end: date


class SnapshotTriggerResponse(BaseModel):
    written: int
    period_start: date
    period_end: date
    message: str


class IngestTriggerRequest(BaseModel):
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    max_records_per_house: int = 1000


class IngestTriggerResponse(BaseModel):
    status: str
    period_start: str
    period_end: str
    records_seen: int
    records_inserted: int
    records_failed: int


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
