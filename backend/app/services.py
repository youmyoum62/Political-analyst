from app.repositories import PoliticianRepository
from app.schemas import AnalysisDetail, PoliticianDetail, PoliticianListItem, RankingItem


class PoliticianService:
    def __init__(self, repo: PoliticianRepository):
        self.repo = repo

    def list_politicians(self) -> list[PoliticianListItem]:
        return [
            PoliticianListItem(id=item.id, name=item.name, party=item.party, house=item.house)
            for item in self.repo.list_politicians()
        ]

    def politician_detail(self, politician_id: int) -> PoliticianDetail | None:
        politician = self.repo.get_politician(politician_id)
        analysis = self.repo.get_analysis(politician_id)
        if not politician or not analysis:
            return None

        return PoliticianDetail(
            id=politician.id,
            name=politician.name,
            party=politician.party,
            house=politician.house,
            district=politician.district,
            term_start=politician.term_start,
            term_end=politician.term_end,
            final_score=analysis.final_score,
        )

    def ranking(self) -> list[RankingItem]:
        rows = self.repo.list_ranking()
        ranking_items: list[RankingItem] = []
        previous_score: float | None = None
        current_rank = 0

        for index, (politician, analysis) in enumerate(rows, start=1):
            if previous_score is None or analysis.final_score != previous_score:
                current_rank = index
            previous_score = analysis.final_score

            ranking_items.append(
                RankingItem(
                    politician_id=politician.id,
                    rank=current_rank,
                    name=politician.name,
                    party=politician.party,
                    final_score=analysis.final_score,
                    trend=0,
                )
            )

        return ranking_items

    def analysis(self, politician_id: int) -> AnalysisDetail | None:
        analysis = self.repo.get_analysis(politician_id)
        if not analysis:
            return None

        return AnalysisDetail(
            politician_id=analysis.politician_id,
            activity_score=analysis.activity_score,
            question_quality_score=analysis.question_quality_score,
            legislative_score=analysis.legislative_score,
            influence_score=analysis.influence_score,
            policy_impact_score=analysis.policy_impact_score,
            final_score=analysis.final_score,
        )
