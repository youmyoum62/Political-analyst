import type { Politician } from '@/lib/types';
import type { ApiAnalysis, ApiScoreHistoryPoint } from '@/lib/api-client';
import { axe } from 'jest-axe';

/** テスト用の Politician を生成する（必要なフィールドだけ上書き）。 */
export function makePolitician(overrides: Partial<Politician> = {}): Politician {
  return {
    id: 1,
    name: '山田太郎',
    party: '自民党',
    age: 50,
    gender: 'Male',
    district: '東京1区',
    house: 'representatives',
    roleProfile: 'ruling',
    score: 75.5,
    rank: 1,
    trend: 0,
    topQuestion: '質問サンプル',
    keyAchievement: '実績サンプル',
    summary: 'サマリーサンプル',
    metrics: {
      participation: 80,
      questionQuality: 70,
      legislation: 60,
      policyImpact: 50,
      influence: 90,
    },
    isInactive: false,
    ...overrides,
  };
}

/** テスト用の ApiAnalysis を生成する。 */
export function makeAnalysis(overrides: Partial<ApiAnalysis> = {}): ApiAnalysis {
  return {
    politician_id: 1,
    role_profile: 'ruling',
    participation_score: 80,
    quality_score: 70,
    legislative_score: 60,
    policy_impact_score: 50,
    influence_score: 90,
    final_score: 72.5,
    weights: {
      participation: 0.2,
      quality: 0.2,
      legislative: 0.2,
      policy_impact: 0.2,
      influence: 0.2,
    },
    ...overrides,
  };
}

/** テスト用のスコア推移ポイントを生成する。 */
export function makeHistoryPoint(
  overrides: Partial<ApiScoreHistoryPoint> = {},
): ApiScoreHistoryPoint {
  return {
    period_start: '2025-01-01',
    period_end: '2025-03-31',
    final_score: 50,
    rank_snapshot: 10,
    computed_at: '2025-04-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * jest-axe による a11y チェック。
 * jsdom は CSS を適用しないため color-contrast は判定不能（誤検出/incomplete になる）。
 * これを無効化し、role/aria/ラベル等の構造的な違反のみを検出する。
 */
export function checkA11y(container: HTMLElement) {
  return axe(container, { rules: { 'color-contrast': { enabled: false } } });
}
