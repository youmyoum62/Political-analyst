import { CompareFeed } from '@/components/CompareFeed';
import { fetchRanking } from '@/lib/api-client';

// force-dynamic を維持（home と同理由: コールドスタートで ISR ビルドが失敗するため）。
export const dynamic = 'force-dynamic';

export default async function ComparePage() {
  const ranking = await fetchRanking();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line bg-surface p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">議員比較</p>
        <h1 className="text-4xl font-black sm:text-6xl">2人を比較する</h1>
        <p className="mt-2 text-muted">議員を2人選んで、5つの評価軸のスコアを比較できます。</p>
      </section>

      <CompareFeed ranking={ranking} />
    </div>
  );
}
