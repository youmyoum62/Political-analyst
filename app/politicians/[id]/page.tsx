import Link from 'next/link';
import { notFound } from 'next/navigation';

import { RadarChart } from '@/components/RadarChart';
import { ShareCard } from '@/components/ShareCard';
import { fetchRanking } from '@/lib/api-client';

export default async function PoliticianPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const politicianId = Number(id);

  const ranking = await fetchRanking();
  const politician = ranking.find((p) => p.id === politicianId);

  if (!politician) {
    notFound();
  }

  const rank = ranking.findIndex((item) => item.id === politician.id) + 1;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm font-semibold text-cyan-300 hover:underline">
        ← ランキングに戻る
      </Link>

      <section className="rounded-3xl border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-500/20 via-slate-900 to-cyan-500/10 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-200">スポットライトプロフィール</p>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">{politician.name}</h1>
        <p className="mt-1 text-slate-200">
          {politician.party} · {politician.house === 'representatives' ? '衆議院' : '参議院'} · {politician.district}
        </p>
        <p className="mt-4 text-6xl font-black text-cyan-300">{politician.score.toFixed(1)}</p>
        <p className="text-sm font-semibold text-slate-200">現在の順位 #{rank} · 議論白熱中</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xl font-black">パワーレーダー</h2>
          <RadarChart metrics={politician.metrics} />
          <p className="mt-2 text-sm text-slate-300">一目で5つの次元を確認。議論を呼ぶ指標。</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="text-lg font-black">このスコアが示すもの</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{politician.summary}</p>
          </div>

          <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4">
            <h3 className="text-lg font-black">注目質問</h3>
            <p className="mt-2 text-sm text-indigo-100">{politician.topQuestion}</p>
          </div>

          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
            <h3 className="text-lg font-black">主な実績</h3>
            <p className="mt-2 text-sm text-emerald-100">{politician.keyAchievement}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">
        話題になろう：この順位に同意する？このカードをシェアして、異論を持つ人に挑戦しよう。
      </section>

      <ShareCard politician={politician} rank={rank} />
    </div>
  );
}
