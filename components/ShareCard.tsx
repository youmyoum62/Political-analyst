'use client';

import { Politician } from '@/lib/types';

export function ShareCard({ politician, rank }: { politician: Politician; rank: number }) {
  const text = `${politician.name}（暫定#${rank}）の国会活動スコアは${politician.score.toFixed(1)}点（暫定値）。評価方法と出典はサイトをご確認ください。`;
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">スコアを共有する</p>
      <div className="mt-3 aspect-square w-full rounded-xl border border-line bg-canvas p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-muted">国会活動スコア</p>
        <p className="mt-4 text-2xl font-black">{politician.name}</p>
        <p className="mt-1 text-sm text-muted">暫定順位 #{rank}</p>
        <p className="mt-5 text-6xl font-black leading-none text-accent">{politician.score.toFixed(1)}</p>
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-muted">暫定値</p>
        <p className="mt-2 text-xs text-muted">出席・発言データ中心の暫定スコアです。</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X でシェアする（新しいウィンドウで開きます）"
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-3 text-sm font-black text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        X で共有する
      </a>
      <p className="mt-2 text-center text-xs text-muted">スコアは暫定値です。出典と評価方法を確認のうえ共有してください。</p>
    </div>
  );
}
