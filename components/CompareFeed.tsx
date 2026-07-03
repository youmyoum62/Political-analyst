'use client';

import { useState } from 'react';

import { RadarChartLazy } from '@/components/RadarChartLazy';
import { Politician } from '@/lib/types';

export function CompareFeed({ ranking }: { ranking: Politician[] }) {
  const [leftId, setLeftId] = useState(ranking[0]?.id ?? 1);
  const [rightId, setRightId] = useState(ranking[1]?.id ?? 2);

  if (ranking.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-xl font-black">比較できるデータがありません</h2>
        <p className="mt-2 text-sm text-muted">
          バックエンド API は空のランキングを返しました。代替データは表示していません。
        </p>
      </section>
    );
  }

  const left = ranking.find((item) => item.id === leftId) ?? ranking[0];
  const right = ranking.find((item) => item.id === rightId) ?? ranking[1];

  const diff = (left?.score ?? 0) - (right?.score ?? 0);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-accent p-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-accent">比較 A</label>
          <select
            aria-label="比較する議員 A を選択"
            className="mt-1 w-full bg-transparent font-semibold focus:outline-none"
            value={leftId}
            onChange={(e) => setLeftId(Number(e.target.value))}
          >
            {ranking.map((item) => (
              <option key={item.id} value={item.id} className="bg-surface">
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-accent2 p-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-accent2">比較 B</label>
          <select
            aria-label="比較する議員 B を選択"
            className="mt-1 w-full bg-transparent font-semibold focus:outline-none"
            value={rightId}
            onChange={(e) => setRightId(Number(e.target.value))}
          >
            {ranking.map((item) => (
              <option key={item.id} value={item.id} className="bg-surface">
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {[left, right].map((person, idx) => (
          <article
            key={person.id}
            className={`rounded-2xl border border-line bg-surface p-4 ${idx === 0 ? 'border-t-4 border-t-accent' : 'border-t-4 border-t-accent2'}`}
          >
            <p className="text-xs uppercase tracking-[0.2em] font-bold" style={{ color: idx === 0 ? '#6ea8ff' : '#e3a857' }}>{idx === 0 ? '比較 A' : '比較 B'}</p>
            <h2 className="mt-2 text-3xl font-black">{person.name}</h2>
            <p className="text-sm text-muted">{person.party}</p>
            <p className="mt-2 text-5xl font-black">{person.score.toFixed(1)}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">暫定値</p>
            <RadarChartLazy metrics={person.metrics} />
            {person.keyAchievement && (
              <p className="mt-3 text-sm text-ink">主な実績: {person.keyAchievement}</p>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">暫定スコア差</p>
        <p className="mt-1 text-5xl font-black text-accent">{diff > 0 ? '+' : ''}{diff.toFixed(1)}</p>
        <p className="mt-2 text-sm text-ink">{diff >= 0 ? `暫定スコアが高いのは ${left?.name} です。` : `暫定スコアが高いのは ${right?.name} です。`}</p>
        <p className="mt-1 text-xs text-muted">※ 出席・発言データ中心の暫定値です。確定的な優劣を示すものではありません。</p>
        <a
          href={`https://x.com/intent/tweet?text=${encodeURIComponent(`${left?.name} ${left?.score.toFixed(1)}点 vs ${right?.name} ${right?.score.toFixed(1)}点（暫定値）。評価方法と出典はサイトをご確認ください。`)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="比較結果を X でシェアする（新しいウィンドウで開きます）"
          className="mt-4 inline-flex rounded-full bg-black px-5 py-2 text-sm font-black text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          X で共有
        </a>
      </section>
    </>
  );
}
