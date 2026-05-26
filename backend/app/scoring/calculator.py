"""
スコア計算エンジン

設計原則:
  - 5軸は完全独立（循環依存なし）
  - 役割プロファイルで重みを変え、与野党・役職バイアスを補正
  - 正規化はウィンソライズ（p95基準）で外れ値を抑制
  - 全関数は純粋関数（DBアクセスなし）
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

RoleProfile = Literal["opposition", "ruling", "cabinet", "parliamentary"]

# ────────────────────────────────────────────────────────────────────────────
# 役割プロファイル重みテーブル
#
# opposition  (野党一般)   : 質問・追及が主業務 → quality を最重視
# ruling      (与党一般)   : 立法・政策推進が主業務 → legislative を重視
# cabinet     (閣僚)       : 法案成立・政策執行 → legislative + policy_impact（質問不可）
# parliamentary(議会役職)  : 議事運営・中立 → influence を最重視
# ────────────────────────────────────────────────────────────────────────────
ROLE_WEIGHTS: dict[str, dict[str, float]] = {
    "opposition": {
        "participation": 0.20,
        "quality":        0.35,
        "legislative":    0.20,
        "policy_impact":  0.15,
        "influence":      0.10,
    },
    "ruling": {
        "participation": 0.15,
        "quality":        0.25,
        "legislative":    0.25,
        "policy_impact":  0.20,
        "influence":      0.15,
    },
    "cabinet": {
        "participation": 0.10,
        "quality":        0.20,
        "legislative":    0.30,
        "policy_impact":  0.25,
        "influence":      0.15,
    },
    "parliamentary": {
        "participation": 0.15,
        "quality":        0.15,
        "legislative":    0.20,
        "policy_impact":  0.20,
        "influence":      0.30,
    },
}

# 起動時に重みの合計を検証
for _profile, _w in ROLE_WEIGHTS.items():
    assert abs(sum(_w.values()) - 1.0) < 1e-9, f"{_profile}: sum={sum(_w.values())}"


# ────────────────────────────────────────────────────────────────────────────
# 役職重みテーブル（透明な固定値 / 政治学的権限階層に基づく）
# ────────────────────────────────────────────────────────────────────────────
ROLE_LEVEL_WEIGHTS: dict[str, float] = {
    "議長": 10.0,       "副議長": 8.0,
    "委員長": 5.0,      "特別委員長": 4.0,   "副委員長": 3.0,
    "筆頭理事": 2.5,    "理事": 2.0,          "委員": 1.0,
    "代表": 9.0,        "幹事長": 7.0,        "政調会長": 6.0,
    "国対委員長": 5.0,  "副代表": 4.0,        "政調副会長": 3.0,
}
ROLE_WEIGHT_MAX = 20.0  # 現実的上限（複数役職の合計）


# ────────────────────────────────────────────────────────────────────────────
# データクラス
# ────────────────────────────────────────────────────────────────────────────

@dataclass
class RawMetrics:
    """議員1名の生指標（集計済み、上限なし）。"""
    # 参加系
    attendance_ratio: float = 0.0       # 出席率 [0.0, 1.0]
    speech_count: int = 0               # 発言回数
    question_count: int = 0             # 質問回数

    # LLM評価（発言・答弁ごとのスコアと信頼度）
    llm_scores: list[float] = field(default_factory=list)
    llm_confidences: list[float] = field(default_factory=list)

    # 立法系
    bills_primary: int = 0              # 主提出法案数
    bills_co_sponsored: int = 0         # 共同提案法案数
    bills_passed_primary: int = 0       # 成立法案数（主提出）
    bills_passed_co: int = 0            # 成立法案数（共同提案）
    bills_in_committee: int = 0         # 審議中法案数
    crossparty_bills_passed: int = 0    # 超党派成立法案数（与野党3党以上）

    # 影響力系
    role_weight_sum: float = 0.0        # 役職重みの合計（ROLE_LEVEL_WEIGHTS参照）


@dataclass
class NormContext:
    """院ごとの母集団統計（正規化基準値）。"""
    speech_p95: float = 1.0
    question_p95: float = 1.0
    bills_primary_p95: float = 1.0
    bills_passed_p95: float = 1.0
    role_weight_p95: float = 1.0


# ────────────────────────────────────────────────────────────────────────────
# ユーティリティ
# ────────────────────────────────────────────────────────────────────────────

def winsorize_normalize(value: float, p95: float) -> float:
    """
    p95を100点基準とするウィンソライズ正規化。
    p95以上はすべて100点（外れ値が他議員のスコアを下げない）。
    """
    if p95 <= 0:
        return 0.0
    return max(0.0, min(100.0, (min(value, p95) / p95) * 100.0))


# ────────────────────────────────────────────────────────────────────────────
# 各スコア計算関数（純粋関数）
# ────────────────────────────────────────────────────────────────────────────

def compute_participation_score(m: RawMetrics, ctx: NormContext) -> float:
    """
    議会参加スコア: 出席率(60%) + 発言・質問量(40%)
    出席率70%未満は乗数ペナルティ（下限0.5倍）。
    """
    volume_norm = winsorize_normalize(
        m.speech_count + m.question_count,
        ctx.speech_p95 + ctx.question_p95,
    )
    attendance_pts = m.attendance_ratio * 100.0
    raw = attendance_pts * 0.60 + volume_norm * 0.40

    penalty = max(0.5, m.attendance_ratio / 0.70) if m.attendance_ratio < 0.70 else 1.0
    return round(min(100.0, raw * penalty), 2)


def compute_quality_score(m: RawMetrics) -> float:
    """
    発言品質スコア: LLM信頼度加重平均。
    最低3件未満は中立値50（サンプル不足の議員を不当に低評価しない）。
    閣僚は答弁テキストも評価対象に含める（ingestスクリプト側で制御）。
    """
    MIN_SAMPLE = 3
    if len(m.llm_scores) < MIN_SAMPLE:
        return 50.0

    total_weight = sum(m.llm_confidences)
    if total_weight == 0.0:
        return 50.0

    weighted = sum(q * c for q, c in zip(m.llm_scores, m.llm_confidences))
    return round(weighted / total_weight, 2)


def compute_legislative_score(m: RawMetrics, ctx: NormContext) -> float:
    """
    立法スコア: プロセス評価（提出・審議の貢献度）。
    成立(50%) + 主提出(30%) + 共同提案(15%) + 審議中(5%)
    """
    passed_total = m.bills_passed_primary + m.bills_passed_co
    passed_norm = winsorize_normalize(passed_total, ctx.bills_passed_p95)
    primary_norm = winsorize_normalize(m.bills_primary, ctx.bills_primary_p95)
    co_norm = min(100.0, (m.bills_co_sponsored / 10.0) * 100.0)
    committee_norm = min(100.0, (m.bills_in_committee / 5.0) * 100.0)

    return round(
        passed_norm * 0.50
        + primary_norm * 0.30
        + co_norm * 0.15
        + committee_norm * 0.05,
        2,
    )


def compute_policy_impact_score(m: RawMetrics, ctx: NormContext) -> float:
    """
    政策実現スコア: アウトカム評価（独立指標、他スコアとの循環依存なし）。

    = 成立寄与スコア × 超党派係数

    成立寄与: 主提出成立×2 + 共同提案成立×1 をp95で正規化
    超党派係数: 1.0 / 1.15（1〜2法案）/ 1.20（3法案以上）

    立法スコアとの違い:
      立法スコア = プロセス（提出・審議）
      政策実現スコア = アウトカム（成立）× 政治的困難度（超党派）
    """
    contribution = m.bills_passed_primary * 2.0 + m.bills_passed_co * 1.0
    base = winsorize_normalize(contribution, max(ctx.bills_passed_p95 * 2.0, 1.0))

    if m.crossparty_bills_passed >= 3:
        multiplier = 1.20
    elif m.crossparty_bills_passed >= 1:
        multiplier = 1.15
    else:
        multiplier = 1.00

    return round(min(100.0, base * multiplier), 2)


def compute_influence_score(m: RawMetrics) -> float:
    """
    制度的影響力スコア: 役職重みテーブルの合計を上限20.0で正規化。
    役職なしは0点（実績主義の原則）。
    """
    normalized = (min(m.role_weight_sum, ROLE_WEIGHT_MAX) / ROLE_WEIGHT_MAX) * 100.0
    return round(normalized, 2)


def compute_final_score(
    participation: float,
    quality: float,
    legislative: float,
    policy_impact: float,
    influence: float,
    role_profile: str,
) -> float:
    """
    最終スコア: 役割プロファイルの重みで加重平均。
    すべての入力スコアは独立して計算済み（循環依存なし）。
    """
    w = ROLE_WEIGHTS.get(role_profile, ROLE_WEIGHTS["ruling"])
    return round(
        participation * w["participation"]
        + quality     * w["quality"]
        + legislative * w["legislative"]
        + policy_impact * w["policy_impact"]
        + influence   * w["influence"],
        2,
    )


def compute_all_scores(
    m: RawMetrics,
    ctx: NormContext,
    role_profile: str,
) -> dict[str, float]:
    """全スコアを一括計算して辞書で返す。"""
    participation = compute_participation_score(m, ctx)
    quality = compute_quality_score(m)
    legislative = compute_legislative_score(m, ctx)
    policy_impact = compute_policy_impact_score(m, ctx)
    influence = compute_influence_score(m)
    final = compute_final_score(participation, quality, legislative, policy_impact, influence, role_profile)

    return {
        "participation_score": participation,
        "quality_score": quality,
        "legislative_score": legislative,
        "policy_impact_score": policy_impact,
        "influence_score": influence,
        "final_score": final,
    }
