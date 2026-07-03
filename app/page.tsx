import { RankingFeed } from '@/components/RankingFeed';
import { fetchRanking } from '@/lib/api-client';

// force-dynamic を維持する。ISR（build 時 prerender）にすると Render 無料枠の
// コールドスタート（最大 ~100 秒）が Next の静的生成上限（60 秒）を超えてビルドが
// 失敗するため（backlog §2-1 の既知リスク）。force-dynamic でもサーバーレンダリング
// された HTML はクロール可能で、SEO 上の不利はない。
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const ranking = await fetchRanking();
  return <RankingFeed ranking={ranking} limit={30} />;
}
