import { Gender, Politician, RoleProfile } from '@/lib/types';

const API_BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:8000';

// ─── Ranking ───────────────────────────────────────────────────────────────

type ApiRankingItem = {
  politician_id: number;
  rank: number;
  name: string;
  party: string;
  house: string;
  district: string | null;
  age: number | null;
  gender: string | null;
  role_profile: string;
  top_question: string | null;
  key_achievement: string | null;
  summary: string | null;
  participation_score: number;
  quality_score: number;
  legislative_score: number;
  policy_impact_score: number;
  influence_score: number;
  final_score: number;
  trend: number;
};

function rankingItemToPolitician(item: ApiRankingItem): Politician {
  return {
    id: item.politician_id,
    name: item.name,
    party: item.party,
    age: item.age,
    gender: item.gender as Gender | null,
    district: item.district ?? '',
    house: item.house as 'representatives' | 'councillors',
    roleProfile: item.role_profile as RoleProfile,
    score: item.final_score,
    trend: item.trend,
    topQuestion: item.top_question ?? '',
    keyAchievement: item.key_achievement ?? '',
    summary: item.summary ?? '',
    metrics: {
      participation: item.participation_score,
      questionQuality: item.quality_score,
      legislation: item.legislative_score,
      policyImpact: item.policy_impact_score,
      influence: item.influence_score,
    },
    isInactive: item.final_score === 0,
  };
}

export async function fetchRanking(): Promise<Politician[]> {
  const res = await fetch(`${API_BASE}/v1/ranking`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('ランキングの取得に失敗しました');
  const data: ApiRankingItem[] = await res.json();
  return data.map(rankingItemToPolitician);
}

// ─── Politician Detail ─────────────────────────────────────────────────────

export type ApiPoliticianDetail = {
  id: number;
  name: string;
  party: string;
  house: string;
  district: string | null;
  age: number | null;
  gender: string | null;
  role_profile: string;
  rank: number | null;
  term_start: string | null;
  term_end: string | null;
  top_question: string | null;
  key_achievement: string | null;
  summary: string | null;
  participation_score: number;
  quality_score: number;
  legislative_score: number;
  policy_impact_score: number;
  influence_score: number;
  final_score: number;
};

export function detailToPolitician(d: ApiPoliticianDetail): Politician {
  return {
    id: d.id,
    name: d.name,
    party: d.party,
    age: d.age,
    gender: d.gender as Gender | null,
    district: d.district ?? '',
    house: d.house as 'representatives' | 'councillors',
    roleProfile: d.role_profile as RoleProfile,
    score: d.final_score,
    trend: 0,
    topQuestion: d.top_question ?? '',
    keyAchievement: d.key_achievement ?? '',
    summary: d.summary ?? '',
    metrics: {
      participation: d.participation_score,
      questionQuality: d.quality_score,
      legislation: d.legislative_score,
      policyImpact: d.policy_impact_score,
      influence: d.influence_score,
    },
    isInactive: d.final_score === 0,
  };
}

export async function fetchPoliticianDetail(id: number): Promise<ApiPoliticianDetail | null> {
  const res = await fetch(`${API_BASE}/v1/politicians/${id}`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('議員詳細の取得に失敗しました');
  return res.json();
}

// ─── Analysis ─────────────────────────────────────────────────────────────

export type ApiAnalysis = {
  politician_id: number;
  role_profile: string;
  participation_score: number;
  quality_score: number;
  legislative_score: number;
  policy_impact_score: number;
  influence_score: number;
  final_score: number;
  weights: {
    participation: number;
    quality: number;
    legislative: number;
    policy_impact: number;
    influence: number;
  };
};

export async function fetchAnalysis(id: number): Promise<ApiAnalysis | null> {
  const res = await fetch(`${API_BASE}/v1/analysis/${id}`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('分析データの取得に失敗しました');
  return res.json();
}

// ─── Score History ─────────────────────────────────────────────────────────

export type ApiScoreHistoryPoint = {
  period_start: string;
  period_end: string;
  final_score: number;
  rank_snapshot: number | null;
  computed_at: string;
};

export async function fetchScoreHistory(id: number): Promise<ApiScoreHistoryPoint[]> {
  const res = await fetch(`${API_BASE}/v1/politicians/${id}/score-history`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  return res.json();
}
