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


class TopSpeechItem(BaseModel):
    """発言・答弁の抜粋＋LLM品質評価（議員詳細ページの一次情報用）。"""
    activity_id: int
    activity_type: str
    session_date: str
    excerpt: str
    score: float
    confidence: Optional[float] = None
    rationale: Optional[str] = None
    source_url: str


class PoliticianBillItem(BaseModel):
    """議員が提出/共同提出/委員会提出した法案（bill_sponsors 経由）。"""
    bill_id: int
    bill_code: str
    title: str
    role: str
    status: str
    submitted_date: Optional[str] = None


class PoliticianRoleItem(BaseModel):
    """役職履歴（influence_roles）。"""
    role_scope: str
    role_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


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
    top_speeches: list[TopSpeechItem] = []
    bills: list[PoliticianBillItem] = []
    roles: list[PoliticianRoleItem] = []


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
    last_ingest_at: str | None = None
    last_ingest_status: str | None = None


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


class ActivityItem(BaseModel):
    id: int
    activity_type: str
    session_date: str
    content_text: Optional[str] = None
    quality_score: Optional[float] = None
    source_url: str


class DigestSpeaker(BaseModel):
    politician_id: int
    name: str
    party: Optional[str] = None
    activity_type: str
    source_url: str


class DigestMinutesDay(BaseModel):
    date: str
    speaker_count: int
    speakers: list[DigestSpeaker]


class DigestBill(BaseModel):
    id: int
    title: str
    status: str
    date: Optional[str] = None
    source_url: Optional[str] = None


class DigestResponse(BaseModel):
    """トップページ「国会の動き」欄。会議録の新着（発言者）と法案の動きを、
    既存の一次データ（国会会議録API・議案DB）から集計する。"""
    generated_at: str
    latest_activity_date: Optional[str] = None
    in_session: bool
    minutes: list[DigestMinutesDay]
    bills: list[DigestBill]


class PartySummary(BaseModel):
    name: str
    member_count: int
    avg_score: float
    median_score: float
    representatives: int
    councillors: int


class PartyMember(BaseModel):
    id: int
    name: str
    house: str
    final_score: float
    rank: Optional[int] = None


class PartyDetail(BaseModel):
    name: str
    member_count: int
    avg_score: float
    median_score: float
    representatives: int
    councillors: int
    members: list[PartyMember]


class BillListItem(BaseModel):
    id: int
    bill_code: str
    title: str
    status: str
    submitted_date: Optional[str] = None
    sponsor_count: int


class BillSponsorItem(BaseModel):
    politician_id: int
    name: str
    role: str


class BillDetail(BaseModel):
    id: int
    bill_code: str
    title: str
    status: str
    submitted_date: Optional[str] = None
    passed_date: Optional[str] = None
    source_url: Optional[str] = None
    sponsors: list[BillSponsorItem]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
