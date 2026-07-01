import Link from 'next/link';

import { Politician } from '@/lib/types';

const houseShort = (house: string) => (house === 'representatives' ? '衆' : house === 'councillors' ? '参' : house);

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
        aria-label={`第${rank}位 ${item.name}（${item.party}）スコア0.0点・発言データなし。詳細を見る`}
        className="group rounded-2xl border border-line bg-surface p-4 opacity-80 transition hover:opacity-100 hover:border-muted"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p aria-hidden="true" className="text-2xl font-black leading-none text-muted sm:text-3xl">#{rank}</p>
            <p className="mt-1 text-lg font-black text-ink sm:text-xl">{item.name}</p>
            <p className="text-xs text-muted sm:text-sm">
              {item.party} · {item.district}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted">スコア</p>
            <p className="text-2xl font-black text-muted sm:text-3xl">0.0</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="rounded-full bg-down/10 px-2 py-1 font-bold text-down">発言データなし</span>
          <span className="font-semibold text-muted transition group-hover:text-ink">詳細を見る →</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/politicians/${item.id}`}
      aria-label={`第${rank}位 ${item.name}（${item.party}）スコア${item.score.toFixed(1)}点${showTrend ? `・前サイクル比${rankDelta > 0 ? `${rankDelta}位上昇` : rankDelta < 0 ? `${Math.abs(rankDelta)}位下降` : '変動なし'}` : ''}。詳細を見る`}
      className="group rounded-2xl border border-line bg-surface p-4 transition hover:border-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p aria-hidden="true" className="text-2xl font-black leading-none text-muted sm:text-3xl">#{rank}</p>
          <p className="mt-1 text-lg font-black sm:text-xl">{item.name}</p>
          <p className="text-xs text-muted sm:text-sm">
            {item.party}
            {item.age ? ` · ${item.age}歳` : ''}
            {item.gender === 'Male' ? ' · 男性' : item.gender === 'Female' ? ' · 女性' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted">スコア</p>
          <p className="text-3xl font-black text-accent sm:text-4xl">{item.score.toFixed(1)}</p>
          {showTrend && (
            <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${rankDelta > 0 ? 'bg-up/10 text-up' : rankDelta < 0 ? 'bg-down/10 text-down' : 'text-muted'}`}>
              {rankDelta > 0 ? `▲ +${rankDelta}` : rankDelta < 0 ? `▼ ${rankDelta}` : '→ 変動なし'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="rounded-md border border-line bg-canvas px-2 py-1 font-bold text-muted">{houseShort(item.house)}</span>
        <span className="font-semibold text-muted transition group-hover:text-ink">詳細を見る →</span>
      </div>
    </Link>
  );
}
