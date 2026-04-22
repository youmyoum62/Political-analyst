'use client';

import { Politician } from '@/lib/types';

export function ShareCard({ politician, rank }: { politician: Politician; rank: number }) {
  const text = `🔥 Debate alert: #${rank} ${politician.name} scored ${politician.score.toFixed(1)} on Political Score Media. Do you agree?`;
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;

  return (
    <div className="rounded-2xl border border-fuchsia-500/60 bg-gradient-to-br from-fuchsia-500/30 via-purple-700/10 to-slate-900 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-200">Share the take</p>
      <div className="mt-3 aspect-square w-full rounded-xl border border-fuchsia-400/50 bg-slate-950/90 p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-300">Political Score Media</p>
        <p className="mt-4 text-2xl font-black">{politician.name}</p>
        <p className="mt-1 text-sm text-slate-300">Current Rank #{rank}</p>
        <p className="mt-5 text-6xl font-black leading-none text-cyan-300">{politician.score.toFixed(1)}</p>
        <p className="mt-5 text-lg font-black text-fuchsia-200">Do you agree?</p>
        <p className="mt-2 text-xs text-slate-300">Tag a friend and challenge their ranking picks.</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
      >
        Share on X
      </a>
      <p className="mt-2 text-center text-xs text-fuchsia-100/80">Hot takes travel faster than facts. Share responsibly.</p>
    </div>
  );
}
