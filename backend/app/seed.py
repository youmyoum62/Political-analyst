from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Analysis, Politician


def seed_if_empty(db: Session) -> None:
    has_rows = db.scalar(select(Politician.id).limit(1))
    if has_rows:
        return

    politicians = [
        Politician(id=1, name='Taro Yamada', party='Reform Party', house='representatives', district='Tokyo-3', term_start=date(2021, 11, 1)),
        Politician(id=2, name='Keiko Tanaka', party='Civic Front', house='representatives', district='Osaka-2', term_start=date(2021, 11, 1)),
        Politician(id=3, name='Hiroshi Sato', party='Green Alliance', house='councillors', district='Kanagawa', term_start=date(2022, 7, 1)),
    ]
    db.add_all(politicians)

    analyses = [
        Analysis(politician_id=1, activity_score=94, question_quality_score=87, legislative_score=92, influence_score=89, policy_impact_score=90, final_score=91.6),
        Analysis(politician_id=2, activity_score=90, question_quality_score=86, legislative_score=85, influence_score=88, policy_impact_score=89, final_score=88.4),
        Analysis(politician_id=3, activity_score=83, question_quality_score=84, legislative_score=88, influence_score=81, policy_impact_score=86, final_score=85.1),
    ]
    db.add_all(analyses)
    db.commit()
