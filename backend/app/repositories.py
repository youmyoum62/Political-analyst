from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Analysis, Politician


class PoliticianRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_politicians(self) -> list[Politician]:
        stmt = select(Politician).order_by(Politician.id.asc())
        return list(self.db.scalars(stmt).all())

    def get_politician(self, politician_id: int) -> Politician | None:
        stmt = select(Politician).where(Politician.id == politician_id)
        return self.db.scalars(stmt).first()

    def get_analysis(self, politician_id: int) -> Analysis | None:
        stmt = select(Analysis).where(Analysis.politician_id == politician_id)
        return self.db.scalars(stmt).first()

    def list_ranking(self) -> list[tuple[Politician, Analysis]]:
        stmt = (
            select(Politician, Analysis)
            .join(Analysis, Analysis.politician_id == Politician.id)
            .order_by(Analysis.final_score.desc(), Politician.id.asc())
        )
        return list(self.db.execute(stmt).all())
