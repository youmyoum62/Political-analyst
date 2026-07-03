from app.models import Politician
from app.party_normalize import normalize_party
from app.repositories import PoliticianRepository
from app.schemas import (
    ActivityItem,
    AnalysisDetail,
    PoliticianDetail,
    PoliticianListItem,
    RankingItem,
)
from app.scoring.calculator import ROLE_WEIGHTS


def _party_name(politician: Politician) -> str:
    # party_rel は list_ranking / list_politicians で joinedload 済み（N+1 回避）。
    # 会派名は normalize_party で正規化し、一覧・詳細・政党ページで表示を一致させる
    # （切り詰めゆれの統合、短縮表記→正式名称の展開）。
    party = politician.party_rel
    return normalize_party(party.name_ja if party else None)


class PoliticianService:
    def __init__(self, repo: PoliticianRepository):
        self.repo = repo

    def list_politicians(
        self, limit: int = 100, offset: int = 0
    ) -> tuple[list[PoliticianListItem], int]:
        politicians = self.repo.list_politicians(limit=limit, offset=offset)
        total = self.repo.count_politicians()
        items = [
            PoliticianListItem(
                id=p.id,
                name=p.name_ja,
                party=_party_name(p),
                house=p.house,
                role_profile=p.role_profile,
            )
            for p in politicians
        ]
        return items, total

    def politician_detail(self, politician_id: int) -> PoliticianDetail | None:
        politician = self.repo.get_politician(politician_id)
        if not politician:
            return None
        sc = self.repo.get_latest_score_component(politician_id)
        if not sc:
            return None

        return PoliticianDetail(
            id=politician.id,
            name=politician.name_ja,
            party=_party_name(politician),
            house=politician.house,
            district=politician.electoral_district,
            age=politician.age,
            gender=politician.gender,
            role_profile=politician.role_profile,
            rank=self.repo.get_politician_rank(politician.id),
            term_start=politician.term_start,
            term_end=politician.term_end,
            top_question=politician.top_question,
            key_achievement=politician.key_achievement,
            summary=politician.summary,
            participation_score=sc.participation_score,
            quality_score=sc.quality_score,
            legislative_score=sc.legislative_score,
            policy_impact_score=sc.policy_impact_score,
            influence_score=sc.influence_score,
            final_score=sc.score.final_score if sc.score else 0.0,
        )

    def ranking(self) -> list[RankingItem]:
        rows = self.repo.list_ranking()
        trend_map = self.repo.get_trend_map()

        ranking_items: list[RankingItem] = []
        previous_score: float | None = None
        current_rank = 0

        for index, (politician, sc, score) in enumerate(rows, start=1):
            if previous_score is None or score.final_score != previous_score:
                current_rank = index
            previous_score = score.final_score

            ranking_items.append(
                RankingItem(
                    politician_id=politician.id,
                    rank=current_rank,
                    name=politician.name_ja,
                    party=_party_name(politician),
                    house=politician.house,
                    district=politician.electoral_district,
                    age=politician.age,
                    gender=politician.gender,
                    role_profile=politician.role_profile,
                    top_question=politician.top_question,
                    key_achievement=politician.key_achievement,
                    summary=politician.summary,
                    participation_score=sc.participation_score,
                    quality_score=sc.quality_score,
                    legislative_score=sc.legislative_score,
                    policy_impact_score=sc.policy_impact_score,
                    influence_score=sc.influence_score,
                    final_score=score.final_score,
                    trend=trend_map.get(politician.id, 0),
                )
            )

        return ranking_items

    def get_activities(
        self,
        politician_id: int,
        limit: int = 10,
        activity_type: str | None = None,
    ) -> list[ActivityItem]:
        rows = self.repo.get_activities(
            politician_id=politician_id,
            limit=limit,
            activity_type=activity_type,
        )
        items: list[ActivityItem] = []
        for activity, llm_eval in rows:
            items.append(
                ActivityItem(
                    id=activity.id,
                    activity_type=activity.activity_type,
                    session_date=activity.session_date.isoformat(),
                    content_text=activity.content_text,
                    quality_score=llm_eval.quality_score if llm_eval else None,
                    source_url=activity.source_url,
                )
            )
        return items

    def analysis(self, politician_id: int) -> AnalysisDetail | None:
        politician = self.repo.get_politician(politician_id)
        if not politician:
            return None
        sc = self.repo.get_latest_score_component(politician_id)
        if not sc:
            return None

        return AnalysisDetail(
            politician_id=politician_id,
            role_profile=politician.role_profile,
            participation_score=sc.participation_score,
            quality_score=sc.quality_score,
            legislative_score=sc.legislative_score,
            policy_impact_score=sc.policy_impact_score,
            influence_score=sc.influence_score,
            final_score=sc.score.final_score if sc.score else 0.0,
            weights=ROLE_WEIGHTS.get(politician.role_profile, ROLE_WEIGHTS["ruling"]),
        )
