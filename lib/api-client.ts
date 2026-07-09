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
 * 単発・50秒タイムアウト。ビルドの静的生成上限（60秒）と Vercel Hobby の
 * ファンクション実行上限（~60秒）の双方に収めるための値。
 * Render のコールドスタート中で 50秒に間に合わなくても空配列を返してビルド/再生成を
 * 失敗させず、その試行が Render を起こすため、次の再生成（revalidate 300秒）で
 * 全議員分に回復する。
 * ユーザー可視ページ（home/compare）では throw する fetchRanking を使い、API ダウンを
 * 空表示でサイレントに隠さない。
 */
export async function fetchRankingSafe(timeoutMs = 50_000): Promise<Politician[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/ranking`, {
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 86400 },
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
  top_speeches?: TopSpeech[];
  bills?: PoliticianBill[];
  roles?: PoliticianRole[];
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

export type DigestSpeaker = {
  politician_id: number;
  name: string;
  party: string | null;
  activity_type: string;
  source_url: string;
};

export type DigestMinutesDay = {
  date: string;
  speaker_count: number;
  speakers: DigestSpeaker[];
};

export type DigestBill = {
  id: number;
  title: string;
  status: string;
  date: string | null;
  source_url: string | null;
};

export type Digest = {
  generated_at: string;
  latest_activity_date: string | null;
  in_session: boolean;
  minutes: DigestMinutesDay[];
  bills: DigestBill[];
};

/**
 * トップページ「国会の動き」欄のデータ。補助コンテンツのため、失敗しても null を返して
 * ホームの描画（ランキング）は止めない。
 */
export async function fetchDigest(): Promise<Digest | null> {
  try {
    const res = await fetchWithRetry(`${API_BASE}/v1/digest`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export type PartySummary = {
  name: string;
  member_count: number;
  avg_score: number;
  median_score: number;
  representatives: number;
  councillors: number;
};

export type PartyMember = {
  id: number;
  name: string;
  house: string;
  final_score: number;
  rank: number | null;
};

export type PartyDetail = PartySummary & { members: PartyMember[] };

export async function fetchParties(): Promise<PartySummary[]> {
  const data = await fetchJson<PartySummary[]>('/v1/parties');
  if (!Array.isArray(data)) throw new Error('API response format error: /v1/parties did not return an array');
  return data;
}

export async function fetchPartyDetail(name: string): Promise<PartyDetail | null> {
  const res = await fetchWithRetry(`${API_BASE}/v1/parties/${encodeURIComponent(name)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiRequestError(`/v1/parties/${name}`, res.status, res.statusText);
  return res.json();
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


// --- Wave2: 議員ドシエ(発言/法案/役職) & 法案ページ 用の型とフェッチャ ---

/** 議員詳細の「発言ハイライト」1件。AI評価つきの発言・質問。 */
export type TopSpeech = {
  activity_id: number;
  activity_type: 'question' | 'speech';
  session_date: string | null;
  excerpt: string;
  score: number | null;
  confidence: number | null;
  rationale: string | null;
  source_url: string | null;
};

/** 議員詳細の「立法活動」1件。提出/共同提出した法案。 */
export type PoliticianBill = {
  bill_id: number;
  bill_code: string;
  title: string;
  role: 'primary' | 'co' | 'committee' | string;
  status: string;
  submitted_date: string | null;
};

/** 議員詳細の「役職」1件。 */
export type PoliticianRole = {
  role_scope: string;
  role_name: string;
  start_date: string | null;
  end_date: string | null;
};

/** 法案一覧の1件。 */
export type BillListItem = {
  id: number;
  bill_code: string;
  title: string;
  status: string;
  submitted_date: string | null;
  sponsor_count: number;
};

export type BillListResponse = {
  items: BillListItem[];
  total: number;
};

/** 法案詳細。 */
export type BillSponsorItem = {
  politician_id: number;
  name: string;
  role: 'primary' | 'co' | 'committee' | string;
};

export type BillDetail = {
  id: number;
  bill_code: string;
  title: string;
  status: string;
  submitted_date: string | null;
  passed_date: string | null;
  source_url: string | null;
  sponsors: BillSponsorItem[];
};

/** 法案一覧。status で絞り込み可。ページング(limit/offset)。 */
export async function fetchBills(opts?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<BillListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  if (opts?.offset != null) params.set('offset', String(opts.offset));
  const query = params.toString() ? `?${params}` : '';
  const data = await fetchJson<BillListResponse>(`/v1/bills${query}`);
  if (!data || !Array.isArray(data.items)) {
    throw new Error('API response format error: /v1/bills did not return items[]');
  }
  return data;
}

/** 法案詳細。存在しなければ null。 */
export async function fetchBill(billCode: string): Promise<BillDetail | null> {
  const res = await fetchWithRetry(`${API_BASE}/v1/bills/${encodeURIComponent(billCode)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiRequestError(`/v1/bills/${billCode}`, res.status, res.statusText);
  return res.json();
}
