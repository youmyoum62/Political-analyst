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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Render 無料プランのコールドスタート（実測 34〜104 秒）に耐えるリトライ付き fetch。
 * - 5xx（起動中の 502/503/504 を含む）とネットワークエラーで再試行する
 * - リトライ間隔を漸増させ、総待機時間を約 90 秒まで確保する
 * - 4xx（404 等）は即座に返し、呼び出し側で処理させる
 */
async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  maxAttempts = 8,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: 60 }, ...init });
      if (res.status >= 500 && attempt < maxAttempts) {
        await sleep(Math.min(3_000 * attempt, 15_000));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await sleep(Math.min(3_000 * attempt, 15_000));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${API_BASE}${path}`);
  if (!res.ok) throw new ApiRequestError(path, res.status, res.statusText);
  return res.json();
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
    rank: item.rank,
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

/**
 * ビルドを止めないランキング取得。sitemap 生成で使う。
 * - ビルド時（NEXT_PHASE=phase-production-build）: 15秒で即諦めて空配列。Render の
 *   コールドスタートでビルドを失敗させない（sitemap は固定ページのみになる）。
 * - ランタイム（ISR の再生成）: 120秒待つ。ビルドの 60秒静的生成上限に縛られないため、
 *   コールドスタート(~100秒)を吸収でき、温まり次第 sitemap が全議員分に回復する。
 * ユーザー可視ページ（home/compare）では throw する fetchRanking を使い、API ダウンを
 * 空表示でサイレントに隠さない。
 */
export async function fetchRankingSafe(): Promise<Politician[]> {
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  const timeoutMs = isBuild ? 15_000 : 120_000;
  try {
    const res = await fetch(`${API_BASE}/v1/ranking`, {
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return (data as ApiRankingItem[]).map(rankingItemToPolitician);
  } catch {
    return [];
  }
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
    rank: d.rank ?? 0,
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
  const res = await fetchWithRetry(`${API_BASE}/v1/politicians/${id}`);
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
  const res = await fetchWithRetry(`${API_BASE}/v1/analysis/${id}`);
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

export type ApiActivityItem = {
  id: number;
  activity_type: 'question' | 'speech' | 'attendance' | 'committee_action';
  session_date: string;
  content_text: string | null;
  quality_score: number | null;
  source_url: string;
};

export async function fetchActivities(
  id: number,
  opts?: { limit?: number; type?: string }
): Promise<ApiActivityItem[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.type) params.set('type', opts.type);
  const query = params.toString() ? `?${params}` : '';
  // activities は補助データのため、失敗しても空配列で詳細ページの描画を止めない
  try {
    const res = await fetchWithRetry(`${API_BASE}/v1/politicians/${id}/activities${query}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
