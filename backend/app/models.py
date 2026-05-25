from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Politician(Base):
    __tablename__ = 'politicians'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    party: Mapped[str] = mapped_column(String(120), nullable=False)
    house: Mapped[str] = mapped_column(String(32), nullable=False)
    district: Mapped[str] = mapped_column(String(120), nullable=False)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(16), nullable=True)
    previous_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    top_question: Mapped[str | None] = mapped_column(String(500), nullable=True)
    key_achievement: Mapped[str | None] = mapped_column(String(500), nullable=True)
    summary: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    term_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    term_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    analyses: Mapped[list['Analysis']] = relationship(back_populates='politician', cascade='all, delete-orphan')


class Analysis(Base):
    __tablename__ = 'analyses'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    politician_id: Mapped[int] = mapped_column(ForeignKey('politicians.id', ondelete='CASCADE'), unique=True, index=True)
    activity_score: Mapped[float] = mapped_column(Float, nullable=False)
    question_quality_score: Mapped[float] = mapped_column(Float, nullable=False)
    legislative_score: Mapped[float] = mapped_column(Float, nullable=False)
    influence_score: Mapped[float] = mapped_column(Float, nullable=False)
    policy_impact_score: Mapped[float] = mapped_column(Float, nullable=False)
    final_score: Mapped[float] = mapped_column(Float, nullable=False, index=True)

    politician: Mapped[Politician] = relationship(back_populates='analyses')
