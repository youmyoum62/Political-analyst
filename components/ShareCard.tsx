'use client';

import { Politician } from '@/lib/types';

export function ShareCard({ politician, rank }: { politician: Politician; rank: number }) {
  const text = `🔥 議論勃発：#${rank}位 ${politician.name}が政治スコアメディアで${politician.score.toFixed(1)}点を獲得。あなたはこの評価に同意する？`;
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;

  return (
    <div className="rounded-2xl border border-fuchsia-500/60 bg-gradient-to-br from-fuchsia-500/30 via-purple-700/10 to-slate-900 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-200">意見をシェアする</p>
      <div className="mt-3 aspect-square w-full rounded-xl border border-fuchsia-400/50 bg-slate-950/90 p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-300">政治スコアメディア</p>
        <p className="mt-4 text-2xl font-black">{politician.name}</p>
        <p className="mt-1 text-sm text-slate-300">現在の順位 #{rank}</p>
        <p className="mt-5 text-6xl font-black leading-none text-cyan-300">{politician.score.toFixed(1)}</p>
        <p className="mt-5 text-lg font-black text-fuchsia-200">あなたは同意する？</p>
        <p className="mt-2 text-xs text-slate-300">友達をタグしてランキング予想を挑戦しよう。</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
      >
        Xでシェアする
      </a>
      <p className="mt-2 text-center text-xs text-fuchsia-100/80">熱い意見は事実より速く広まる。責任を持ってシェアしよう。</p>
    </div>
  );
}
