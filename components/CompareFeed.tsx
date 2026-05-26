'use client';

import { useState } from 'react';

import { RadarChart } from '@/components/RadarChart';
import { Politician } from '@/lib/types';

export function CompareFeed({ ranking }: { ranking: Politician[] }) {
  const [leftId, setLeftId] = useState(ranking[0]?.id ?? 1);
  const [rightId, setRightId] = useState(ranking[1]?.id ?? 2);

  const left = ranking.find((item) => item.id === leftId) ?? ranking[0];
  const right = ranking.find((item) => item.id === rightId) ?? ranking[1];

  const diff = (left?.score ?? 0) - (right?.score ?? 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <select className="rounded-xl border border-cyan-500/30 bg-slate-900 p-3 font-semibold" value={leftId} onChange={(e) => setLeftId(Number(e.target.value))}>
          {ranking.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <select className="rounded-xl border border-fuchsia-500/30 bg-slate-900 p-3 font-semibold" value={rightId} onChange={(e) => setRightId(Number(e.target.value))}>
          {ranking.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {[left, right].map((person, idx) => (
          <article key={person.id} className={`rounded-2xl border p-4 ${idx === 0 ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-fuchsia-500/40 bg-fuchsia-500/10'}`}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{idx === 0 ? '左コーナー' : '右コーナー'}</p>
            <h2 className="mt-2 text-3xl font-black">{person.name}</h2>
            <p className="text-sm text-slate-300">{person.party}</p>
            <p className="mt-2 text-5xl font-black">{person.score.toFixed(1)}</p>
            <RadarChart metrics={person.metrics} />
            <p className="mt-3 text-sm font-semibold text-slate-100">主な実績: {person.keyAchievement}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">スコア差</p>
        <p className="mt-1 text-5xl font-black text-cyan-300">{diff > 0 ? '+' : ''}{diff.toFixed(1)}</p>
        <p className="mt-2 text-sm text-slate-200">{diff >= 0 ? `${left?.name}がこのバトルをリードしています。` : `${right?.name}がこのバトルをリードしています。`}</p>
        <a
          href={`https://x.com/intent/tweet?text=${encodeURIComponent(`バトル結果: ${left?.name} ${left?.score.toFixed(1)}点 vs ${right?.name} ${right?.score.toFixed(1)}点。あなたはどちらが勝つと思う？`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex rounded-full bg-black px-5 py-2 text-sm font-black text-white transition hover:bg-slate-800"
        >
          Xでバトルをシェア
        </a>
      </section>
    </>
  );
}
