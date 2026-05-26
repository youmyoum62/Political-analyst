from app.repositories import PoliticianRepository
from app.schemas import AnalysisDetail, PoliticianDetail, PoliticianListItem, RankingItem
from app.scoring.calculator import ROLE_WEIGHTS


def _party_name(repo: PoliticianRepository, party_id: int | None) -> str:
    if party_id is None:
        return "無所属"
    party = repo.get_party(party_id)
    return party.name_ja if party else "無所属"


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
                party=_party_name(self.repo, p.party_id),
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
            party=_party_name(self.repo, politician.party_id),
            house=politician.house,
            district=politician.electoral_district,
            age=politician.age,
            gender=politician.gender,
            role_profile=politician.role_profile,
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
                    party=_party_name(self.repo, politician.party_id),
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
