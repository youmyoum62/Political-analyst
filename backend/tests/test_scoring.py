"""
スコアリングエンジン単体テスト

calculator.py の純粋関数を網羅的にテストする。
- 境界値・ペナルティ発動条件・循環依存なし・役割プロファイル重みの合計
"""

import pytest

from app.scoring.calculator import (
    ROLE_WEIGHTS,
    NormContext,
    RawMetrics,
    compute_all_scores,
    compute_final_score,
    compute_influence_score,
    compute_legislative_score,
    compute_participation_score,
    compute_policy_impact_score,
    compute_quality_score,
    winsorize_normalize,
)

# ─── winsorize_normalize ───────────────────────────────────────────────────

class TestWinsorizeNormalize:
    def test_zero_value(self):
        assert winsorize_normalize(0.0, 100.0) == 0.0

    def test_at_p95(self):
        assert winsorize_normalize(100.0, 100.0) == 100.0

    def test_above_p95_clamped(self):
        assert winsorize_normalize(200.0, 100.0) == 100.0

    def test_midpoint(self):
        assert winsorize_normalize(50.0, 100.0) == pytest.approx(50.0)

    def test_p95_zero_returns_zero(self):
        assert winsorize_normalize(99.0, 0.0) == 0.0

    def test_negative_value_clamped(self):
        assert winsorize_normalize(-10.0, 100.0) == 0.0


# ─── compute_participation_score ──────────────────────────────────────────

class TestParticipationScore:
    def _ctx(self, speech_p95=100.0, question_p95=100.0):
        return NormContext(speech_p95=speech_p95, question_p95=question_p95)

    def test_full_attendance_max_volume(self):
        m = RawMetrics(attendance_ratio=1.0, speech_count=100, question_count=100)
        score = compute_participation_score(m, self._ctx())
        assert score == 100.0

    def test_zero_activity(self):
        m = RawMetrics(attendance_ratio=0.0, speech_count=0, question_count=0)
        score = compute_participation_score(m, self._ctx())
        assert score == 0.0

    def test_below_70_percent_attendance_penalty(self):
        # 出席率 50% → ペナルティあり（乗数 < 1）
        m_low = RawMetrics(attendance_ratio=0.5, speech_count=50, question_count=50)
        m_high = RawMetrics(attendance_ratio=1.0, speech_count=50, question_count=50)
        ctx = self._ctx()
        assert compute_participation_score(m_low, ctx) < compute_participation_score(m_high, ctx)

    def test_attendance_70_no_penalty(self):
        # 70% ちょうどはペナルティなし
        m = RawMetrics(attendance_ratio=0.70, speech_count=0, question_count=0)
        ctx = self._ctx()
        score = compute_participation_score(m, ctx)
        assert score == pytest.approx(0.70 * 100.0 * 0.60, abs=0.5)

    def test_score_never_exceeds_100(self):
        m = RawMetrics(attendance_ratio=1.0, speech_count=9999, question_count=9999)
        assert compute_participation_score(m, self._ctx()) <= 100.0


# ─── compute_quality_score ────────────────────────────────────────────────

class TestQualityScore:
    def test_fewer_than_3_samples_returns_50(self):
        m = RawMetrics(llm_scores=[90.0, 80.0], llm_confidences=[0.9, 0.8])
        assert compute_quality_score(m) == 50.0

    def test_empty_samples_returns_50(self):
        m = RawMetrics()
        assert compute_quality_score(m) == 50.0

    def test_zero_confidence_returns_50(self):
        m = RawMetrics(
            llm_scores=[80.0, 70.0, 90.0],
            llm_confidences=[0.0, 0.0, 0.0],
        )
        assert compute_quality_score(m) == 50.0

    def test_weighted_average(self):
        # scores=[100, 0], confidences=[1, 1] → 加重平均 = 50
        m = RawMetrics(
            llm_scores=[100.0, 0.0, 60.0],
            llm_confidences=[1.0, 1.0, 0.0],
        )
        # confidence 合計 = 2, weighted = 100 + 0 = 100 → 100/2 = 50
        assert compute_quality_score(m) == pytest.approx(50.0, abs=0.1)

    def test_high_confidence_sample_dominates(self):
        m = RawMetrics(
            llm_scores=[10.0, 90.0, 90.0],
            llm_confidences=[0.01, 1.0, 1.0],
        )
        score = compute_quality_score(m)
        assert score > 80.0


# ─── compute_legislative_score ────────────────────────────────────────────

class TestLegislativeScore:
    def _ctx(self):
        return NormContext(bills_primary_p95=10.0, bills_passed_p95=5.0)

    def test_no_bills(self):
        m = RawMetrics()
        assert compute_legislative_score(m, self._ctx()) == 0.0

    def test_only_passed_bills(self):
        m = RawMetrics(bills_passed_primary=5)
        score = compute_legislative_score(m, self._ctx())
        assert score > 0.0

    def test_score_never_exceeds_100(self):
        m = RawMetrics(
            bills_primary=100, bills_co_sponsored=100,
            bills_passed_primary=50, bills_passed_co=50,
            bills_in_committee=100,
        )
        assert compute_legislative_score(m, self._ctx()) <= 100.0

    def test_passed_weighted_more_than_submitted(self):
        ctx = self._ctx()
        m_passed = RawMetrics(bills_passed_primary=5)
        m_submitted = RawMetrics(bills_primary=10)
        assert compute_legislative_score(m_passed, ctx) > compute_legislative_score(m_submitted, ctx)


# ─── compute_policy_impact_score ──────────────────────────────────────────

class TestPolicyImpactScore:
    def _ctx(self):
        return NormContext(bills_passed_p95=5.0)

    def test_no_bills_returns_zero(self):
        m = RawMetrics()
        assert compute_policy_impact_score(m, self._ctx()) == 0.0

    def test_crossparty_multiplier_1_bill(self):
        ctx = self._ctx()
        m_normal = RawMetrics(bills_passed_primary=2, crossparty_bills_passed=0)
        m_cross1 = RawMetrics(bills_passed_primary=2, crossparty_bills_passed=1)
        assert compute_policy_impact_score(m_cross1, ctx) > compute_policy_impact_score(m_normal, ctx)

    def test_crossparty_multiplier_3_bills(self):
        ctx = self._ctx()
        m1 = RawMetrics(bills_passed_primary=2, crossparty_bills_passed=1)
        m3 = RawMetrics(bills_passed_primary=2, crossparty_bills_passed=3)
        assert compute_policy_impact_score(m3, ctx) > compute_policy_impact_score(m1, ctx)

    def test_independent_of_quality_legislative_influence(self):
        """循環依存なし: quality/legislative/influence を変えても policy_impact_score は変わらない。"""
        ctx = self._ctx()
        m_base = RawMetrics(bills_passed_primary=3)
        m_varied = RawMetrics(
            bills_passed_primary=3,
            # quality/legislative/influence 系を極端に変える
            llm_scores=[100.0] * 10,
            llm_confidences=[1.0] * 10,
            bills_primary=50,
            role_weight_sum=20.0,
        )
        base_score = compute_policy_impact_score(m_base, ctx)
        varied_score = compute_policy_impact_score(m_varied, ctx)
        # 同じ bills_passed_primary ならスコアは同じ
        assert base_score == pytest.approx(varied_score, abs=0.01)

    def test_score_never_exceeds_100(self):
        m = RawMetrics(bills_passed_primary=999, crossparty_bills_passed=999)
        assert compute_policy_impact_score(m, self._ctx()) <= 100.0


# ─── compute_influence_score ──────────────────────────────────────────────

class TestInfluenceScore:
    def test_no_role_returns_zero(self):
        m = RawMetrics(role_weight_sum=0.0)
        assert compute_influence_score(m) == 0.0

    def test_max_role_returns_100(self):
        m = RawMetrics(role_weight_sum=20.0)  # ROLE_WEIGHT_MAX = 20
        assert compute_influence_score(m) == 100.0

    def test_above_max_clamped(self):
        m = RawMetrics(role_weight_sum=999.0)
        assert compute_influence_score(m) == 100.0

    def test_proportional(self):
        m10 = RawMetrics(role_weight_sum=10.0)
        assert compute_influence_score(m10) == pytest.approx(50.0)


# ─── compute_final_score ──────────────────────────────────────────────────

class TestFinalScore:
    def test_all_zeros_returns_zero(self):
        assert compute_final_score(0, 0, 0, 0, 0, "opposition") == 0.0

    def test_all_100_returns_100(self):
        assert compute_final_score(100, 100, 100, 100, 100, "opposition") == pytest.approx(100.0)

    def test_role_profiles_differ(self):
        """同じスコアでも役割プロファイルが違えば最終スコアは異なる。"""
        args = (80.0, 50.0, 60.0, 40.0, 70.0)
        scores = {
            profile: compute_final_score(*args, profile)
            for profile in ("opposition", "ruling", "cabinet", "parliamentary")
        }
        # 4つすべて異なる値であるべき
        assert len(set(scores.values())) == 4

    def test_unknown_profile_falls_back_to_ruling(self):
        score_unknown = compute_final_score(80, 50, 60, 40, 70, "unknown_profile")
        score_ruling = compute_final_score(80, 50, 60, 40, 70, "ruling")
        assert score_unknown == pytest.approx(score_ruling)


# ─── ROLE_WEIGHTS 構造検証 ────────────────────────────────────────────────

class TestRoleWeights:
    def test_all_profiles_present(self):
        assert set(ROLE_WEIGHTS.keys()) == {"opposition", "ruling", "cabinet", "parliamentary"}

    @pytest.mark.parametrize("profile", ["opposition", "ruling", "cabinet", "parliamentary"])
    def test_weights_sum_to_1(self, profile: str):
        total = sum(ROLE_WEIGHTS[profile].values())
        assert total == pytest.approx(1.0, abs=1e-9), f"{profile}: sum={total}"

    @pytest.mark.parametrize("profile", ["opposition", "ruling", "cabinet", "parliamentary"])
    def test_all_weights_positive(self, profile: str):
        for axis, w in ROLE_WEIGHTS[profile].items():
            assert w > 0, f"{profile}.{axis} は正の値であるべき"

    def test_required_axes(self):
        required = {"participation", "quality", "legislative", "policy_impact", "influence"}
        for profile, weights in ROLE_WEIGHTS.items():
            assert required == set(weights.keys()), f"{profile}: 軸が不正"


# ─── compute_all_scores 統合チェック ─────────────────────────────────────

class TestComputeAllScores:
    def test_returns_all_keys(self):
        m = RawMetrics(attendance_ratio=0.9, speech_count=10)
        ctx = NormContext(speech_p95=20.0, question_p95=10.0)
        result = compute_all_scores(m, ctx, "opposition")
        required = {"participation_score", "quality_score", "legislative_score",
                    "policy_impact_score", "influence_score", "final_score"}
        assert required == set(result.keys())

    def test_all_scores_in_range(self):
        m = RawMetrics(
            attendance_ratio=0.85, speech_count=30, question_count=20,
            bills_primary=5, bills_passed_primary=2,
            llm_scores=[75.0, 80.0, 70.0],
            llm_confidences=[0.8, 0.9, 0.7],
            role_weight_sum=5.0,
        )
        ctx = NormContext(
            speech_p95=50.0, question_p95=30.0,
            bills_primary_p95=8.0, bills_passed_p95=3.0,
        )
        result = compute_all_scores(m, ctx, "ruling")
        for key, val in result.items():
            assert 0.0 <= val <= 100.0, f"{key} = {val} が範囲外"
