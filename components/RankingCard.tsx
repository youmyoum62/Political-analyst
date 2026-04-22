import Link from 'next/link';

import { Politician } from '@/lib/types';

const medalStyle: Record<number, string> = {
  1: 'from-amber-300/45 to-yellow-600/20 border-amber-300/70',
  2: 'from-slate-200/35 to-slate-400/10 border-slate-300/60',
  3: 'from-orange-300/35 to-orange-700/10 border-orange-300/60'
};

const dramaTag = (rank: number) => {
  if (rank === 1) return 'Headline Leader';
  if (rank <= 3) return 'Podium Fight';
  if (rank <= 5) return 'Top Tier';
  return 'Watchlist';
};

export function RankingCard({ item, rank }: { item: Politician; rank: number }) {
  const rankDelta = item.previousRank - rank;

  return (
    <Link
      href={`/politicians/${item.id}`}
      className={`group rounded-2xl border bg-gradient-to-br p-4 transition duration-200 hover:-translate-y-1 hover:shadow-2xl ${medalStyle[rank] ?? 'border-slate-800 from-slate-900 to-slate-900'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[2.4rem] font-black leading-none sm:text-5xl">#{rank}</p>
          <p className="mt-1 text-lg font-black sm:text-xl">{item.name}</p>
          <p className="text-xs text-slate-300 sm:text-sm">
            {item.party} · {item.age} · {item.gender}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-slate-300">Score</p>
          <p className="text-3xl font-black text-cyan-300 sm:text-4xl">{item.score.toFixed(1)}</p>
          <p className={`mt-1 text-xs font-bold ${rankDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {rankDelta >= 0 ? `▲ +${rankDelta}` : `▼ ${rankDelta}`} vs last cycle
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="rounded-full border border-white/25 bg-white/10 px-2 py-1 font-bold uppercase tracking-[0.15em] text-slate-200">{dramaTag(rank)}</span>
        <span className="font-semibold text-fuchsia-200 opacity-80 transition group-hover:opacity-100">Tap to investigate →</span>
      </div>
    </Link>
  );
}
