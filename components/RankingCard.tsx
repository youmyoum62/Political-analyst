import Link from 'next/link';

import { Politician } from '@/lib/types';

const medalStyle: Record<number, string> = {
  1: 'from-amber-300/45 to-yellow-600/20 border-amber-300/70',
  2: 'from-slate-200/35 to-slate-400/10 border-slate-300/60',
  3: 'from-orange-300/35 to-orange-700/10 border-orange-300/60'
};

const dramaTag = (rank: number) => {
  if (rank === 1) return 'トップリーダー';
  if (rank <= 3) return '表彰台争い';
  if (rank <= 5) return 'トップクラス';
  return '注目候補';
};

export function RankingCard({
  item,
  rank,
  showTrend = false,
}: {
  item: Politician;
  rank: number;
  showTrend?: boolean;
}) {
  const rankDelta = item.trend;

  if (item.isInactive) {
    return (
      <Link
        href={`/politicians/${item.id}`}
        aria-label={`第${rank}位 ${item.name}（${item.party}）スコア0.0点・発言ゼロ。詳細を見る`}
        className="group rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 opacity-75 transition duration-200 hover:opacity-100 hover:shadow-lg hover:shadow-rose-900/20"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[2.4rem] font-black leading-none text-slate-600 sm:text-5xl">#{rank}</p>
            <p className="mt-1 text-lg font-black text-slate-300 sm:text-xl">{item.name}</p>
            <p className="text-xs text-slate-500 sm:text-sm">
              {item.party} · {item.district}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">スコア</p>
            <p className="text-3xl font-black text-slate-500 sm:text-4xl">0.0</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="rounded-full border border-rose-500/50 bg-rose-900/40 px-2 py-1 font-bold tracking-wide text-rose-300">
            ⚠ 発言ゼロ
          </span>
          <span className="font-semibold text-slate-500 transition group-hover:text-slate-300">詳細を見る →</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/politicians/${item.id}`}
      aria-label={`第${rank}位 ${item.name}（${item.party}）スコア${item.score.toFixed(1)}点${showTrend ? `・前サイクル比${rankDelta > 0 ? `${rankDelta}位上昇` : rankDelta < 0 ? `${Math.abs(rankDelta)}位下降` : '変動なし'}` : ''}。詳細を見る`}
      className={`group rounded-2xl border bg-gradient-to-br p-4 transition duration-200 hover:-translate-y-1 hover:shadow-2xl ${medalStyle[rank] ?? 'border-slate-800 from-slate-900 to-slate-900'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[2.4rem] font-black leading-none sm:text-5xl">#{rank}</p>
          <p className="mt-1 text-lg font-black sm:text-xl">{item.name}</p>
          <p className="text-xs text-slate-300 sm:text-sm">
            {item.party}
            {item.age ? ` · ${item.age}歳` : ''}
            {item.gender === 'Male' ? ' · 男性' : item.gender === 'Female' ? ' · 女性' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-slate-300">スコア</p>
          <p className="text-3xl font-black text-cyan-300 sm:text-4xl">{item.score.toFixed(1)}</p>
          {showTrend && (
            <p className={`mt-1 text-xs font-bold ${rankDelta > 0 ? 'text-emerald-300' : rankDelta < 0 ? 'text-rose-300' : 'text-slate-400'}`}>
              {rankDelta > 0 ? `▲ +${rankDelta}` : rankDelta < 0 ? `▼ ${rankDelta}` : '→ 変動なし'} 前サイクル比
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="rounded-full border border-white/25 bg-white/10 px-2 py-1 font-bold uppercase tracking-[0.15em] text-slate-200">{dramaTag(rank)}</span>
        <span className="font-semibold text-fuchsia-200 opacity-80 transition group-hover:opacity-100">詳細を見る →</span>
      </div>
    </Link>
  );
}
