"""
DBモデル定義（SQLite / PostgreSQL 共通）

テーブル一覧:
  parties            政党マスタ
  politicians        議員（role_profile で役割プロファイルを保持）
  ingestion_runs     インジェスト実行履歴
  activities         発言・出席・委員会行動ログ
  bills              法案マスタ
  bill_sponsors      法案‐議員 中間テーブル
  influence_roles    役職履歴（重み付け済み）
  llm_evaluations    LLM品質評価結果
  weight_sets        重みセットバージョン管理
  score_components   スコア構成要素スナップショット（時系列）
  scores             最終スコア + 順位スナップショット（時系列）
"""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# ─────────────────────────────────────────────
# 参照テーブル
# ─────────────────────────────────────────────

class Party(Base):
    __tablename__ = "parties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name_ja: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    abbreviation: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    politicians: Mapped[list["Politician"]] = relationship(back_populates="party_rel")


class Politician(Base):
    __tablename__ = "politicians"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_ref: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    name_ja: Mapped[str] = mapped_column(String(120), nullable=False)
    party_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("parties.id", ondelete="SET NULL"), nullable=True
    )
    electoral_district: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    # 'representatives' | 'councillors'
    house: Mapped[str] = mapped_column(String(32), nullable=False)
    # 'opposition' | 'ruling' | 'cabinet' | 'parliamentary'
    role_profile: Mapped[str] = mapped_column(String(32), nullable=False, default="ruling")
    gender: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    term_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    term_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    top_question: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    key_achievement: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    party_rel: Mapped[Optional[Party]] = relationship(back_populates="politicians")
    activities: Mapped[list["Activity"]] = relationship(back_populates="politician")
    bill_sponsors: Mapped[list["BillSponsor"]] = relationship(back_populates="politician")
    influence_roles: Mapped[list["InfluenceRole"]] = relationship(back_populates="politician")
    score_components: Mapped[list["ScoreComponent"]] = relationship(back_populates="politician")
    scores: Mapped[list["Score"]] = relationship(back_populates="politician")

    __table_args__ = (
        CheckConstraint("house IN ('representatives', 'councillors')", name="ck_politicians_house"),
        CheckConstraint(
            "role_profile IN ('opposition', 'ruling', 'cabinet', 'parliamentary')",
            name="ck_politicians_role_profile",
        ),
        Index("idx_politicians_party_id", "party_id"),
        Index("idx_politicians_house_active", "house", "is_active"),
    )


# ─────────────────────────────────────────────
# インジェスト管理
# ─────────────────────────────────────────────

class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # 'running' | 'success' | 'failure' | 'partial'
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="running")
    records_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_inserted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    activities: Mapped[list["Activity"]] = relationship(back_populates="ingestion_run")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    politician_id: Mapped[int] = mapped_column(
        ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False
    )
    ingestion_run_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ingestion_runs.id", ondelete="SET NULL"), nullable=True
    )
    # 'question' | 'speech' | 'attendance' | 'committee_action'
    activity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    session_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    content_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    politician: Mapped[Politician] = relationship(back_populates="activities")
    ingestion_run: Mapped[Optional[IngestionRun]] = relationship(back_populates="activities")
    llm_evaluation: Mapped[Optional["LlmEvaluation"]] = relationship(
        back_populates="activity", uselist=False
    )

    __table_args__ = (
        CheckConstraint(
            "activity_type IN ('question', 'speech', 'attendance', 'committee_action')",
            name="ck_activities_type",
        ),
        Index("idx_activities_politician_date", "politician_id", "session_date"),
        Index("idx_activities_type_date", "activity_type", "session_date"),
    )


# ─────────────────────────────────────────────
# 立法テーブル
# ─────────────────────────────────────────────

class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bill_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    # 'submitted' | 'in_committee' | 'passed' | 'rejected' | 'withdrawn'
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="submitted")
    submitted_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    passed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    sponsors: Mapped[list["BillSponsor"]] = relationship(back_populates="bill")


class BillSponsor(Base):
    __tablename__ = "bill_sponsors"

    bill_id: Mapped[int] = mapped_column(
        ForeignKey("bills.id", ondelete="CASCADE"), primary_key=True
    )
    politician_id: Mapped[int] = mapped_column(
        ForeignKey("politicians.id", ondelete="CASCADE"), primary_key=True
    )
    # 'primary' | 'co' | 'committee'
    sponsor_role: Mapped[str] = mapped_column(String(32), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bill: Mapped[Bill] = relationship(back_populates="sponsors")
    politician: Mapped[Politician] = relationship(back_populates="bill_sponsors")

    __table_args__ = (
        Index("idx_bill_sponsors_politician_role", "politician_id", "sponsor_role"),
    )


class InfluenceRole(Base):
    __tablename__ = "influence_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    politician_id: Mapped[int] = mapped_column(
        ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False
    )
    # 'committee' | 'party' | 'parliament'
    role_scope: Mapped[str] = mapped_column(String(32), nullable=False)
    role_name: Mapped[str] = mapped_column(String(120), nullable=False)
    level_weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    politician: Mapped[Politician] = relationship(back_populates="influence_roles")

    __table_args__ = (
        CheckConstraint("level_weight >= 0", name="ck_influence_roles_weight"),
        Index("idx_influence_roles_politician", "politician_id", "end_date"),
    )


# ─────────────────────────────────────────────
# LLM評価
# ─────────────────────────────────────────────

class LlmEvaluation(Base):
    __tablename__ = "llm_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    activity_id: Mapped[int] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(64), nullable=False)
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rationale_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evaluated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # 'queued' | 'succeeded' | 'failed'
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    activity: Mapped[Activity] = relationship(back_populates="llm_evaluation")

    __table_args__ = (
        CheckConstraint(
            "quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)",
            name="ck_llm_quality_score_range",
        ),
        CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="ck_llm_confidence_range",
        ),
        Index("idx_llm_eval_status", "status", "evaluated_at"),
    )


# ─────────────────────────────────────────────
# スコア管理（時系列）
# ─────────────────────────────────────────────

class WeightSet(Base):
    """重みセットのバージョン管理。スコア計算時の重みを永続化する。"""
    __tablename__ = "weight_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # opposition プロファイルの重み
    opp_participation: Mapped[float] = mapped_column(Float, nullable=False)
    opp_quality: Mapped[float] = mapped_column(Float, nullable=False)
    opp_legislative: Mapped[float] = mapped_column(Float, nullable=False)
    opp_policy_impact: Mapped[float] = mapped_column(Float, nullable=False)
    opp_influence: Mapped[float] = mapped_column(Float, nullable=False)
    # ruling プロファイルの重み
    rul_participation: Mapped[float] = mapped_column(Float, nullable=False)
    rul_quality: Mapped[float] = mapped_column(Float, nullable=False)
    rul_legislative: Mapped[float] = mapped_column(Float, nullable=False)
    rul_policy_impact: Mapped[float] = mapped_column(Float, nullable=False)
    rul_influence: Mapped[float] = mapped_column(Float, nullable=False)
    # cabinet プロファイルの重み
    cab_participation: Mapped[float] = mapped_column(Float, nullable=False)
    cab_quality: Mapped[float] = mapped_column(Float, nullable=False)
    cab_legislative: Mapped[float] = mapped_column(Float, nullable=False)
    cab_policy_impact: Mapped[float] = mapped_column(Float, nullable=False)
    cab_influence: Mapped[float] = mapped_column(Float, nullable=False)
    # parliamentary プロファイルの重み
    par_participation: Mapped[float] = mapped_column(Float, nullable=False)
    par_quality: Mapped[float] = mapped_column(Float, nullable=False)
    par_legislative: Mapped[float] = mapped_column(Float, nullable=False)
    par_policy_impact: Mapped[float] = mapped_column(Float, nullable=False)
    par_influence: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    score_components: Mapped[list["ScoreComponent"]] = relationship(back_populates="weight_set")


class ScoreComponent(Base):
    """スコア構成要素スナップショット（時系列で蓄積）。"""
    __tablename__ = "score_components"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    politician_id: Mapped[int] = mapped_column(
        ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False
    )
    weight_set_id: Mapped[int] = mapped_column(
        ForeignKey("weight_sets.id", ondelete="RESTRICT"), nullable=False
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    participation_score: Mapped[float] = mapped_column(Float, nullable=False)
    quality_score: Mapped[float] = mapped_column(Float, nullable=False)
    legislative_score: Mapped[float] = mapped_column(Float, nullable=False)
    policy_impact_score: Mapped[float] = mapped_column(Float, nullable=False)
    influence_score: Mapped[float] = mapped_column(Float, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    politician: Mapped[Politician] = relationship(back_populates="score_components")
    weight_set: Mapped[WeightSet] = relationship(back_populates="score_components")
    score: Mapped[Optional["Score"]] = relationship(back_populates="component_set", uselist=False)

    __table_args__ = (
        CheckConstraint("period_end >= period_start", name="ck_score_components_period"),
        UniqueConstraint(
            "politician_id", "period_start", "period_end",
            name="uq_score_components_period",
        ),
        Index("idx_score_components_politician", "politician_id", "computed_at"),
    )


class Score(Base):
    """最終スコア + 順位スナップショット（trend計算の基盤）。"""
    __tablename__ = "scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    politician_id: Mapped[int] = mapped_column(
        ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False
    )
    component_set_id: Mapped[int] = mapped_column(
        ForeignKey("score_components.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    final_score: Mapped[float] = mapped_column(Float, nullable=False)
    rank_snapshot: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    politician: Mapped[Politician] = relationship(back_populates="scores")
    component_set: Mapped[ScoreComponent] = relationship(back_populates="score")

    __table_args__ = (
        CheckConstraint("final_score BETWEEN 0 AND 100", name="ck_scores_final_score"),
        CheckConstraint("rank_snapshot IS NULL OR rank_snapshot > 0", name="ck_scores_rank"),
        Index("idx_scores_politician_computed", "politician_id", "computed_at"),
        Index("idx_scores_computed_final", "computed_at", "final_score"),
    )
