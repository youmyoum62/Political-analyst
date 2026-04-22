'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { FilterBar } from '@/components/FilterBar';
import { RankingCard } from '@/components/RankingCard';
import { ShareCard } from '@/components/ShareCard';
import { AgeGroup, filterPoliticians, getBiggestDrops, getParties, getRankedPoliticians, getRisingPoliticians } from '@/lib/api';

export default function HomePage() {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('All');
  const [party, setParty] = useState('All');
  const [gender, setGender] = useState('All');

  const ranking = useMemo(() => getRankedPoliticians(), []);
  const parties = useMemo(() => getParties(), []);
  const filtered = useMemo(() => filterPoliticians(ranking, { ageGroup, party, gender }), [ageGroup, party, gender, ranking]);
  const rising = useMemo(() => getRisingPoliticians(), []);
  const drops = useMemo(() => getBiggestDrops(), []);

  const hero = filtered[0] ?? ranking[0];
  const heroRank = Math.max(1, ranking.findIndex((item) => item.id === hero.id) + 1);

  return (
    <div className="space-y-6">
      <section className="media-hero rounded-3xl p-5 sm:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-100">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-300" />
          Breaking Rank Shift
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Political Score Media</p>
        <h1 className="mt-2 text-4xl font-black leading-[0.95] sm:text-6xl md:text-7xl">
          Japan&apos;s Political
          <br />
          Power Board
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-100 sm:text-lg">
          Winners, collapses, and shocking moves updated in one glance. React instantly, compare rivals, and post your verdict.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/compare" className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-black text-slate-950 transition hover:scale-105">
            Start Battle Compare
          </Link>
          <a href="#ranking-feed" className="rounded-full border border-white/40 bg-white/10 px-5 py-2 text-sm font-bold transition hover:bg-white/20">
            See Live Ranking
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100">Today&apos;s Flashpoint</p>
        <p className="mt-2 text-lg font-bold sm:text-2xl">
          #{heroRank} {hero.name} is fueling debate after a <span className="text-cyan-300">{hero.score.toFixed(1)} score</span>. Do you call this fair?
        </p>
      </section>

      <FilterBar ageGroup={ageGroup} party={party} gender={gender} parties={parties} onAgeGroupChange={setAgeGroup} onPartyChange={setParty} onGenderChange={setGender} />

      <section id="ranking-feed" className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live Leaderboard</p>
            <h2 className="text-2xl font-black sm:text-3xl">Who Owns The Narrative?</h2>
          </div>
          <p className="text-sm text-slate-300">{filtered.length} contenders match your filter</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, idx) => (
            <RankingCard key={item.id} item={item} rank={idx + 1} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <h2 className="text-xl font-black">Rising Politicians 🚀</h2>
          <div className="mt-3 space-y-2 text-sm">
            {rising.map((item) => (
              <p key={item.id}>
                <span className="font-bold">{item.name}</span> <span className="text-emerald-300">▲ +{item.rankDelta}</span>
              </p>
            ))}
          </div>
          <p className="mt-3 text-xs text-emerald-100/80">Momentum stories are share magnets. Post your pick before the next update.</p>
        </div>

        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
          <h2 className="text-xl font-black">Biggest Drops ⚠️</h2>
          <div className="mt-3 space-y-2 text-sm">
            {drops.map((item) => (
              <p key={item.id}>
                <span className="font-bold">{item.name}</span> <span className="text-rose-300">▼ {item.rankDelta}</span>
              </p>
            ))}
          </div>
          <p className="mt-3 text-xs text-rose-100/80">Drops trigger debate. Challenge the ranking and share your evidence.</p>
        </div>

        <ShareCard politician={hero} rank={heroRank} />
      </section>
    </div>
  );
}
