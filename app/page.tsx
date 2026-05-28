import { RankingFeed } from '@/components/RankingFeed';
import { fetchRanking } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const ranking = await fetchRanking();
  return <RankingFeed ranking={ranking} />;
}
