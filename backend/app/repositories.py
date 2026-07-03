from sqlalchemy import func, nulls_last, select, text
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Activity,
    Bill,
    IngestionRun,
    LlmEvaluation,
    Party,
    Politician,
    Score,
    ScoreComponent,
)


class AdminRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_ingestion_runs(self, limit: int = 20) -> list[IngestionRun]:
        return list(
            self.db.scalars(
                select(IngestionRun)
                .order_by(IngestionRun.started_at.desc())
                .limit(limit)
            ).all()
        )


class DigestRepository:
    """トップページ「国会の動き」欄のための集計クエリ。
    既存の activities（会議録）と bills（議案DB）から読み取るだけで、
    新規のスクレイピングや外部取得は行わない。"""

    # 「発言」として扱う活動種別（出席イベントは除外）
    _MINUTES_TYPES = ("question", "speech", "committee_action")

    def __init__(self, db: Session):
        self.db = db

    def recent_activities(self, row_limit: int = 150) -> list:
        """最近の発言系 activity を新しい順で返す (Activity, Politician, Party)。"""
        stmt = (
            select(Activity, Politician, Party)
            .join(Politician, Politician.id == Activity.politician_id)
            .outerjoin(Party, Party.id == Politician.party_id)
            .where(
                Activity.activity_type.in_(self._MINUTES_TYPES),
                Politician.is_active == True,  # noqa: E712
            )
            .order_by(Activity.session_date.desc(), Activity.id.desc())
            .limit(row_limit)
        )
        return list(self.db.execute(stmt).all())

    def recent_bills(self, limit: int = 8) -> list[Bill]:
        """最近動きのあった法案を、可決日→提出日→更新日時の順で新しい順に返す。"""
        stmt = (
            select(Bill)
            .order_by(
                nulls_last(func.coalesce(Bill.passed_date, Bill.submitted_date).desc()),
                Bill.updated_at.desc(),
            )
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())


class PoliticianRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_politicians(self, limit: int = 100, offset: int = 0) -> list[Politician]:
        stmt = (
            select(Politician)
            .options(joinedload(Politician.party_rel))
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

    def get_politician_rank(self, politician_id: int) -> int | None:
        """スコアに基づく競争順位（同点は同順位、次順位は繰り下げ）を返す。

        永続化された rank_snapshot は再計算のたびに非連続・不整合になり得るため参照しない。
        ランキング一覧（services.ranking）と同一データ・同一定義でスコア降順の順位を
        算出し、一覧と詳細の順位を必ず一致させる（順位 = 自分より高スコアの人数 + 1）。
        """
        rows = self.list_ranking()
        target: float | None = None
        for politician, _component, score in rows:
            if politician.id == politician_id:
                target = score.final_score
                break
        if target is None:
            return None
        return 1 + sum(1 for _p, _c, score in rows if score.final_score > target)

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
            .options(joinedload(Politician.party_rel))
            .join(latest_component_sq, Politician.id == latest_component_sq.c.politician_id)
            .join(ScoreComponent, ScoreComponent.id == latest_component_sq.c.component_id)
            .join(Score, Score.component_set_id == ScoreComponent.id)
            .where(Politician.is_active == True)  # noqa: E712
            .order_by(Score.final_score.desc(), Politician.id.asc())
        )
        return list(self.db.execute(stmt).all())

    def get_score_history(self, politician_id: int, limit: int = 12) -> list[tuple]:
        """議員のスコア履歴を古い順で返す (ScoreComponent, Score) のタプルリスト。"""
        stmt = (
            select(ScoreComponent, Score)
            .join(Score, Score.component_set_id == ScoreComponent.id)
            .where(ScoreComponent.politician_id == politician_id)
            .order_by(ScoreComponent.computed_at.asc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).all())

    def get_activities(
        self,
        politician_id: int,
        limit: int = 10,
        activity_type: str | None = None,
    ) -> list[tuple]:
        from sqlalchemy import nulls_last

        conditions = [Activity.politician_id == politician_id]
        if activity_type is not None:
            conditions.append(Activity.activity_type == activity_type)

        stmt = (
            select(Activity, LlmEvaluation)
            .outerjoin(LlmEvaluation, LlmEvaluation.activity_id == Activity.id)
            .where(*conditions)
            .order_by(
                nulls_last(LlmEvaluation.quality_score.desc()),
                Activity.session_date.desc(),
            )
            .limit(limit)
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
