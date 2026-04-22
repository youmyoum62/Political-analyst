import Link from 'next/link';
import { notFound } from 'next/navigation';

import { RadarChart } from '@/components/RadarChart';
import { ShareCard } from '@/components/ShareCard';
import { getPoliticianById, getRankedPoliticians } from '@/lib/api';

export default function PoliticianPage({ params }: { params: { id: string } }) {
  const politicianId = Number(params.id);
  const politician = getPoliticianById(politicianId);

  if (!politician) {
    notFound();
  }

  const ranking = getRankedPoliticians();
  const rank = ranking.findIndex((item) => item.id === politician.id) + 1;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm font-semibold text-cyan-300 hover:underline">
        ← Back to Ranking
      </Link>

      <section className="rounded-3xl border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-500/20 via-slate-900 to-cyan-500/10 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-200">Spotlight Profile</p>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">{politician.name}</h1>
        <p className="mt-1 text-slate-200">
          {politician.party} · {politician.house} · {politician.district}
        </p>
        <p className="mt-4 text-6xl font-black text-cyan-300">{politician.score.toFixed(1)}</p>
        <p className="text-sm font-semibold text-slate-200">Current Rank #{rank} · Debate intensity high</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xl font-black">Power Radar</h2>
          <RadarChart metrics={politician.metrics} />
          <p className="mt-2 text-sm text-slate-300">One glance, five dimensions, and a lot to argue about.</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="text-lg font-black">Why this score hits hard</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{politician.summary}</p>
          </div>

          <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4">
            <h3 className="text-lg font-black">Top Question</h3>
            <p className="mt-2 text-sm text-indigo-100">{politician.topQuestion}</p>
          </div>

          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
            <h3 className="text-lg font-black">Key Achievement</h3>
            <p className="mt-2 text-sm text-emerald-100">{politician.keyAchievement}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">
        Viral prompt: Agree with this placement? Share this card and challenge someone who disagrees.
      </section>

      <ShareCard politician={politician} rank={rank} />
    </div>
  );
}
