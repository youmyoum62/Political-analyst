"""
スナップショット再計算

DBに蓄積された実データ（activities, bills, influence_roles, llm_evaluations）から
各議員のスコアを計算し、score_components + scores テーブルに書き込む。

使い方:
    from app.scoring.snapshot import recompute_snapshot
    recompute_snapshot(db, period_start=date(2026, 2, 26), period_end=date(2026, 5, 26))
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Optional

import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Activity,
    Bill,
    BillSponsor,
    InfluenceRole,
    LlmEvaluation,
    Politician,
    Score,
    ScoreComponent,
    WeightSet,
)
from app.scoring.calculator import (
    ROLE_LEVEL_WEIGHTS,
    NormContext,
    RawMetrics,
    compute_all_scores,
)

log = logging.getLogger(__name__)


def _p95(values: list[float]) -> float:
    if not values:
        return 1.0
    result = float(np.percentile(values, 95))
    return max(result, 1.0)


def _build_raw_metrics(politician_id: int, db: Session, period_start: date, period_end: date) -> RawMetrics:
    """DBから1議員の生指標を集計する。"""
    m = RawMetrics()

    # 出席率（attendance activity の平均）
    attendance_acts = (
        db.query(Activity)
        .filter(
            Activity.politician_id == politician_id,
            Activity.activity_type == "attendance",
            Activity.session_date >= period_start,
            Activity.session_date <= period_end,
        )
        .all()
    )
    if attendance_acts:
        attended = sum(1 for a in attendance_acts if a.content_text == "present")
        m.attendance_ratio = attended / len(attendance_acts)

    # 発言・質問回数
    speech_q = (
        db.query(func.count(Activity.id))
        .filter(
            Activity.politician_id == politician_id,
            Activity.activity_type == "speech",
            Activity.session_date >= period_start,
            Activity.session_date <= period_end,
        )
        .scalar()
    ) or 0
    question_q = (
        db.query(func.count(Activity.id))
        .filter(
            Activity.politician_id == politician_id,
            Activity.activity_type == "question",
            Activity.session_date >= period_start,
            Activity.session_date <= period_end,
        )
        .scalar()
    ) or 0
    m.speech_count = speech_q
    m.question_count = question_q

    # LLM評価スコア
    llm_rows = (
        db.query(LlmEvaluation)
        .join(Activity, Activity.id == LlmEvaluation.activity_id)
        .filter(
            Activity.politician_id == politician_id,
            Activity.session_date >= period_start,
            Activity.session_date <= period_end,
            LlmEvaluation.status == "succeeded",
        )
        .all()
    )
    m.llm_scores = [float(r.quality_score) for r in llm_rows]
    m.llm_confidences = [float(r.confidence) for r in llm_rows]

    # 立法系（BillSponsor 経由）
    sponsored = (
        db.query(Bill, BillSponsor)
        .join(BillSponsor, Bill.id == BillSponsor.bill_id)
        .filter(
            BillSponsor.politician_id == politician_id,
            Bill.submitted_date >= period_start,
            Bill.submitted_date <= period_end,
        )
        .all()
    )
    for bill, sponsor in sponsored:
        if sponsor.sponsor_role == "primary":
            m.bills_primary += 1
            if bill.status == "passed":
                m.bills_passed_primary += 1
        elif sponsor.sponsor_role == "co":
            m.bills_co_sponsored += 1
            if bill.status == "passed":
                m.bills_passed_co += 1
        if bill.status == "in_committee":
            m.bills_in_committee += 1

    # 超党派成立法案: 実データ投入時に party 数を集計するクエリに置き換える
    m.crossparty_bills_passed = 0

    # 役職重み
    roles = (
        db.query(InfluenceRole)
        .filter(
            InfluenceRole.politician_id == politician_id,
            InfluenceRole.start_date <= period_end,
        )
        .filter(
            (InfluenceRole.end_date == None) | (InfluenceRole.end_date >= period_start)  # noqa: E711
        )
        .all()
    )
    for role in roles:
        weight = ROLE_LEVEL_WEIGHTS.get(role.role_name, role.level_weight or 0.0)
        m.role_weight_sum += weight

    return m


def _build_norm_context(politician_ids: list[int], db: Session, period_start: date, period_end: date) -> NormContext:
    """対象議員全員の指標からp95正規化コンテキストを作る。"""
    speech_vals, question_vals, primary_vals, passed_vals = [], [], [], []

    for pid in politician_ids:
        m = _build_raw_metrics(pid, db, period_start, period_end)
        speech_vals.append(float(m.speech_count))
        question_vals.append(float(m.question_count))
        primary_vals.append(float(m.bills_primary))
        passed_vals.append(float(m.bills_passed_primary + m.bills_passed_co))

    return NormContext(
        speech_p95=_p95(speech_vals),
        question_p95=_p95(question_vals),
        bills_primary_p95=_p95(primary_vals),
        bills_passed_p95=_p95(passed_vals),
        role_weight_p95=20.0,
    )


def recompute_snapshot(
    db: Session,
    period_start: date,
    period_end: date,
    weight_set_id: Optional[int] = None,
) -> int:
    """
    全アクティブ議員のスコアを再計算し score_components + scores に書き込む。
    既存の同一期間レコードはスキップ（冪等性）。
    書き込んだ件数を返す。
    """
    politicians = db.query(Politician).filter(Politician.is_active == True).all()  # noqa: E712
    if not politicians:
        log.warning("アクティブな議員が0件 — スナップショットをスキップ")
        return 0

    if weight_set_id is None:
        ws = db.query(WeightSet).order_by(WeightSet.id.desc()).first()
        weight_set_id = ws.id if ws else None

    pids = [p.id for p in politicians]
    ctx = _build_norm_context(pids, db, period_start, period_end)

    written = 0
    for politician in politicians:
        # 同一期間が既にある場合はスキップ
        existing = (
            db.query(ScoreComponent)
            .filter(
                ScoreComponent.politician_id == politician.id,
                ScoreComponent.period_start == period_start,
                ScoreComponent.period_end == period_end,
            )
            .first()
        )
        if existing:
            log.debug("スキップ (politician_id=%d, 既存レコード)", politician.id)
            continue

        m = _build_raw_metrics(politician.id, db, period_start, period_end)
        scores = compute_all_scores(m, ctx, politician.role_profile)

        component = ScoreComponent(
            politician_id=politician.id,
            weight_set_id=weight_set_id,
            period_start=period_start,
            period_end=period_end,
            participation_score=scores["participation_score"],
            quality_score=scores["quality_score"],
            legislative_score=scores["legislative_score"],
            policy_impact_score=scores["policy_impact_score"],
            influence_score=scores["influence_score"],
        )
        db.add(component)
        db.flush()  # component.id を確定

        score_row = Score(
            component_set_id=component.id,
            final_score=scores["final_score"],
            rank_snapshot=None,  # ランク付けは後続処理で設定
        )
        db.add(score_row)
        written += 1

    db.flush()
    _assign_ranks(db, period_start, period_end)
    db.commit()

    log.info("スナップショット完了: %d件書き込み (period=%s〜%s)", written, period_start, period_end)
    return written


def _assign_ranks(db: Session, period_start: date, period_end: date) -> None:
    """今回書き込んだスナップショットの rank_snapshot を確定する。"""
    components = (
        db.query(ScoreComponent, Score)
        .join(Score, Score.component_set_id == ScoreComponent.id)
        .filter(
            ScoreComponent.period_start == period_start,
            ScoreComponent.period_end == period_end,
        )
        .order_by(Score.final_score.desc())
        .all()
    )
    for rank, (_, score_row) in enumerate(components, start=1):
        score_row.rank_snapshot = rank
