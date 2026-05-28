import { Gender, Politician, RoleProfile } from '@/lib/types';

export const API_BASE = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'https://political-analyst-api.onrender.com'
).replace(/\/+$/, '');

class ApiRequestError extends Error {
  constructor(path: string, status: number, statusText: string) {
    super(`API request failed: ${path} returned ${status} ${statusText}`);
    this.name = 'ApiRequestError';
  }
}

async function fetchJson<T>(path: string, attemptsLeft = 3): Promise<T> {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(58_000), // Render free tier cold start ~34s
    });
    if (!res.ok) throw new ApiRequestError(path, res.status, res.statusText);
    return res.json();
  } catch (err) {
    if (attemptsLeft > 1) {
      await new Promise((r) => setTimeout(r, 2_000));
      return fetchJson<T>(path, attemptsLeft - 1);
    }
    throw err;
  }
}

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
  const data = await fetchJson<ApiRankingItem[]>('/v1/ranking');
  if (!Array.isArray(data)) throw new Error('API response format error: /v1/ranking did not return an array');
  return data.map(rankingItemToPolitician);
}

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
  if (!res.ok) throw new ApiRequestError(`/v1/politicians/${id}`, res.status, res.statusText);
  return res.json();
}

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
  if (!res.ok) throw new ApiRequestError(`/v1/analysis/${id}`, res.status, res.statusText);
  return res.json();
}

export type ApiScoreHistoryPoint = {
  period_start: string;
  period_end: string;
  final_score: number;
  rank_snapshot: number | null;
  computed_at: string;
};

export async function fetchScoreHistory(id: number): Promise<ApiScoreHistoryPoint[]> {
  const data = await fetchJson<ApiScoreHistoryPoint[]>(`/v1/politicians/${id}/score-history`);
  if (!Array.isArray(data)) {
    throw new Error(`API response format error: /v1/politicians/${id}/score-history did not return an array`);
  }
  return data;
}
