import type { Metadata } from 'next';

import { RankingFeed } from '@/components/RankingFeed';
import { fetchRanking } from '@/lib/api-client';

// force-dynamic を維持（home と同理由: コールドスタートで ISR ビルドが失敗するため）。
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '全議員ランキング',
  description:
    '国会議員全員の活動スコアランキング。院・年代・党派・性別で絞り込み、発言データなしの議員も含めて確認できます。スコアは公開データから算出した暫定値です。',
};

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ pref?: string }>;
}) {
  const [ranking, params] = await Promise.all([fetchRanking(), searchParams]);
  const pref = typeof params.pref === 'string' ? params.pref : 'All';
  return <RankingFeed ranking={ranking} initialPrefecture={pref} />;
}
