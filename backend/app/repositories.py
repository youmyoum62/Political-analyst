from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import Party, Politician, Score, ScoreComponent


class PoliticianRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_politicians(self, limit: int = 100, offset: int = 0) -> list[Politician]:
        stmt = (
            select(Politician)
            .where(Politician.is_active == True)  # noqa: E712
            .order_by(Politician.id.asc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt).all())

    def count_politicians(self) -> int:
        from sqlalchemy import func
        return self.db.scalar(
            select(func.count()).select_from(Politician).where(Politician.is_active == True)  # noqa: E712
        ) or 0

    def get_politician(self, politician_id: int) -> Politician | None:
        return self.db.get(Politician, politician_id)

    def get_party(self, party_id: int) -> Party | None:
        return self.db.get(Party, party_id)

    def get_latest_score_component(self, politician_id: int) -> ScoreComponent | None:
        stmt = (
            select(ScoreComponent)
            .where(ScoreComponent.politician_id == politician_id)
            .order_by(ScoreComponent.computed_at.desc())
            .limit(1)
        )
        return self.db.scalars(stmt).first()

    def list_ranking(self) -> list[tuple[Politician, ScoreComponent, Score]]:
        """
        最新スナップショットの議員・スコア構成・最終スコアを順位順で返す。
        最新スナップショット = 各議員の computed_at が最大のもの。
        """
        from sqlalchemy import func

        # 各議員の最新 computed_at を取得
        max_date_sq = (
            select(
                ScoreComponent.politician_id,
                func.max(ScoreComponent.computed_at).label("max_computed_at"),
            )
            .group_by(ScoreComponent.politician_id)
            .subquery()
        )

        # max_computed_at に一致する ScoreComponent.id を取得
        latest_component_sq = (
            select(
                ScoreComponent.id.label("component_id"),
                ScoreComponent.politician_id,
            )
            .join(
                max_date_sq,
                (ScoreComponent.politician_id == max_date_sq.c.politician_id)
                & (ScoreComponent.computed_at == max_date_sq.c.max_computed_at),
            )
            .subquery()
        )

        stmt = (
            select(Politician, ScoreComponent, Score)
            .join(latest_component_sq, Politician.id == latest_component_sq.c.politician_id)
            .join(ScoreComponent, ScoreComponent.id == latest_component_sq.c.component_id)
            .join(Score, Score.component_set_id == ScoreComponent.id)
            .where(Politician.is_active == True)  # noqa: E712
            .order_by(Score.final_score.desc(), Politician.id.asc())
        )
        return list(self.db.execute(stmt).all())

    def get_trend_map(self) -> dict[int, int]:
        """
        全議員の trend（順位変動）を返す。
        trend > 0: 上昇（前期より順位が上がった）
        trend < 0: 下降
        trend = 0: 変化なし / 前期データなし
        """
        sql = text("""
            WITH ranked AS (
                SELECT
                    sc.politician_id,
                    s.rank_snapshot,
                    ROW_NUMBER() OVER (
                        PARTITION BY sc.politician_id
                        ORDER BY s.computed_at DESC
                    ) AS rn
                FROM scores s
                JOIN score_components sc ON sc.id = s.component_set_id
                WHERE s.rank_snapshot IS NOT NULL
            ),
            latest  AS (SELECT politician_id, rank_snapshot FROM ranked WHERE rn = 1),
            prev    AS (SELECT politician_id, rank_snapshot FROM ranked WHERE rn = 2)
            SELECT
                l.politician_id,
                COALESCE(p.rank_snapshot, l.rank_snapshot) - l.rank_snapshot AS trend
            FROM latest l
            LEFT JOIN prev p ON l.politician_id = p.politician_id
        """)
        rows = self.db.execute(sql).fetchall()
        return {row.politician_id: int(row.trend or 0) for row in rows}
