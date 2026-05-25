import { Gender, Politician } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type ApiRankingItem = {
  politician_id: number;
  rank: number;
  name: string;
  party: string;
  house: string;
  district: string;
  age: number | null;
  gender: string | null;
  previous_rank: number | null;
  top_question: string | null;
  key_achievement: string | null;
  summary: string | null;
  activity_score: number;
  question_quality_score: number;
  legislative_score: number;
  influence_score: number;
  policy_impact_score: number;
  final_score: number;
  trend: number;
};

function toFrontendPolitician(item: ApiRankingItem): Politician {
  return {
    id: item.politician_id,
    name: item.name,
    party: item.party,
    age: item.age ?? 0,
    gender: (item.gender as Gender) ?? 'Male',
    district: item.district,
    house: item.house as 'representatives' | 'councillors',
    score: item.final_score,
    previousRank: item.previous_rank ?? item.rank,
    topQuestion: item.top_question ?? '',
    keyAchievement: item.key_achievement ?? '',
    summary: item.summary ?? '',
    metrics: {
      activity: item.activity_score,
      questionQuality: item.question_quality_score,
      legislation: item.legislative_score,
      influence: item.influence_score,
      impact: item.policy_impact_score,
    },
    isInactive: item.final_score === 0,
  };
}

export async function fetchRanking(): Promise<Politician[]> {
  const res = await fetch(`${API_BASE}/ranking`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('ランキングの取得に失敗しました');
  const data: ApiRankingItem[] = await res.json();
  return data.map(toFrontendPolitician);
}
