from app.models import Politician
from app.party_normalize import normalize_party
from app.repositories import BillRepository, PoliticianRepository
from app.schemas import (
    ActivityItem,
    AnalysisDetail,
    BillDetail,
    BillListItem,
    BillSponsorItem,
    PoliticianBillItem,
    PoliticianDetail,
    PoliticianListItem,
    PoliticianRoleItem,
    RankingItem,
    TopSpeechItem,
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
            top_speeches=self._top_speeches(politician_id),
            bills=self._bills(politician_id),
            roles=self._roles(politician_id),
        )

    def _top_speeches(self, politician_id: int) -> list[TopSpeechItem]:
        rows = self.repo.get_top_speeches(politician_id)
        items: list[TopSpeechItem] = []
        for activity, llm_eval in rows:
            text = (activity.content_text or "").strip()
            items.append(
                TopSpeechItem(
                    activity_id=activity.id,
                    activity_type=activity.activity_type,
                    session_date=activity.session_date.isoformat(),
                    excerpt=text[:200],
                    score=llm_eval.quality_score,
                    confidence=llm_eval.confidence,
                    rationale=llm_eval.rationale_summary,
                    source_url=activity.source_url,
                )
            )
        return items

    def _bills(self, politician_id: int) -> list[PoliticianBillItem]:
        rows = self.repo.get_bill_sponsorships(politician_id)
        return [
            PoliticianBillItem(
                bill_id=bill.id,
                bill_code=bill.bill_code,
                title=bill.title,
                role=sponsor.sponsor_role,
                status=bill.status,
                submitted_date=bill.submitted_date.isoformat() if bill.submitted_date else None,
            )
            for sponsor, bill in rows
        ]

    def _roles(self, politician_id: int) -> list[PoliticianRoleItem]:
        rows = self.repo.get_influence_roles(politician_id)
        return [
            PoliticianRoleItem(
                role_scope=r.role_scope,
                role_name=r.role_name,
                start_date=r.start_date.isoformat() if r.start_date else None,
                end_date=r.end_date.isoformat() if r.end_date else None,
            )
            for r in rows
        ]

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


class BillService:
    def __init__(self, repo: BillRepository):
        self.repo = repo

    def list_bills(
        self, limit: int = 50, offset: int = 0, status: str | None = None
    ) -> tuple[list[BillListItem], int]:
        rows = self.repo.list_bills(limit=limit, offset=offset, status=status)
        total = self.repo.count_bills(status=status)
        items = [
            BillListItem(
                id=bill.id,
                bill_code=bill.bill_code,
                title=bill.title,
                status=bill.status,
                submitted_date=bill.submitted_date.isoformat() if bill.submitted_date else None,
                sponsor_count=int(count),
            )
            for bill, count in rows
        ]
        return items, total

    def bill_detail(self, bill_code: str) -> BillDetail | None:
        bill = self.repo.get_bill_by_code(bill_code)
        if not bill:
            return None
        sponsor_rows = self.repo.get_bill_sponsors(bill.id)
        sponsors = [
            BillSponsorItem(politician_id=pol.id, name=pol.name_ja, role=sponsor.sponsor_role)
            for sponsor, pol in sponsor_rows
        ]
        return BillDetail(
            id=bill.id,
            bill_code=bill.bill_code,
            title=bill.title,
            status=bill.status,
            submitted_date=bill.submitted_date.isoformat() if bill.submitted_date else None,
            passed_date=bill.passed_date.isoformat() if bill.passed_date else None,
            source_url=bill.source_url,
            sponsors=sponsors,
        )
