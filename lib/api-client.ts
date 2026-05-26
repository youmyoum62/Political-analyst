import { Gender, Politician, RoleProfile } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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

function toFrontendPolitician(item: ApiRankingItem): Politician {
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
  return data.map(toFrontendPolitician);
}
