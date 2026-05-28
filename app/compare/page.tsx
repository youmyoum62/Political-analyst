import { CompareFeed } from '@/components/CompareFeed';
import { fetchRanking } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export default async function ComparePage() {
  const ranking = await fetchRanking();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-500/25 to-cyan-500/15 p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-200">バトルアリーナ</p>
        <h1 className="text-4xl font-black sm:text-6xl">一対一の対決</h1>
        <p className="mt-2 text-slate-100">2人の政治家を選んで強みを比較し、勝者を投稿しよう。</p>
      </section>

      <CompareFeed ranking={ranking} />
    </div>
  );
}
