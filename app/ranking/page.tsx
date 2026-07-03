import type { Metadata } from 'next';

import { RankingFeed } from '@/components/RankingFeed';
import { fetchRanking } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '全議員ランキング',
  description:
    '国会議員全員の活動スコアランキング。院・年代・党派・性別で絞り込み、発言データなしの議員も含めて確認できます。スコアは公開データから算出した暫定値です。',
};

export default async function RankingPage() {
  const ranking = await fetchRanking();
  return <RankingFeed ranking={ranking} />;
}
