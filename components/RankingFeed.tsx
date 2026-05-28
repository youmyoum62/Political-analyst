'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { FilterBar } from '@/components/FilterBar';
import { RankingCard } from '@/components/RankingCard';
import { ShareCard } from '@/components/ShareCard';
import { AgeGroup, HouseFilter, filterPoliticians, getBiggestDrops, getParties, getRankedPoliticians, getRisingPoliticians } from '@/lib/api';
import { Politician } from '@/lib/types';

export function RankingFeed({ ranking }: { ranking: Politician[] }) {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('All');
  const [party, setParty] = useState('All');
  const [gender, setGender] = useState('All');
  const [house, setHouse] = useState<HouseFilter>('All');
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const sorted = useMemo(() => getRankedPoliticians(ranking), [ranking]);
  const parties = useMemo(() => getParties(ranking), [ranking]);
  const inactiveCount = useMemo(() => ranking.filter((p) => p.isInactive).length, [ranking]);

  const filtered = useMemo(
    () => filterPoliticians(sorted, { ageGroup, party, gender, house, query, showInactive }),
    [ageGroup, party, gender, house, query, showInactive, sorted]
  );

  const rising = useMemo(() => getRisingPoliticians(ranking), [ranking]);
  const drops = useMemo(() => getBiggestDrops(ranking), [ranking]);

  const activeFiltered = filtered.filter((p) => !p.isInactive);
  const inactiveFiltered = filtered.filter((p) => p.isInactive);

  const hero = activeFiltered[0] ?? sorted.find((p) => !p.isInactive) ?? sorted[0];

  if (!hero) {
    return (
      <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
        <h1 className="text-2xl font-black text-amber-100">ランキングデータがありません</h1>
        <p className="mt-2 text-sm text-amber-100/80">
          バックエンド API は空のランキングを返しました。代替データは表示していません。
        </p>
      </section>
    );
  }

  const heroRank = Math.max(1, sorted.findIndex((item) => item.id === hero.id) + 1);

  return (
    <div className="space-y-6">
      <section className="media-hero rounded-3xl p-5 sm:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-100">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-300" />
          速報ランク変動
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">政治スコアメディア</p>
        <h1 className="mt-2 text-4xl font-black leading-[0.95] sm:text-6xl md:text-7xl">
          日本の政治
          <br />
          パワーボード
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-100 sm:text-lg">
          勝者・失速・衝撃の動きを一目で確認。即反応し、ライバルと比較して、あなたの評決を投稿しよう。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/compare" className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-black text-slate-950 transition hover:scale-105">
            バトル比較を始める
          </Link>
          <a href="#ranking-feed" className="rounded-full border border-white/40 bg-white/10 px-5 py-2 text-sm font-bold transition hover:bg-white/20">
            ライブランキングを見る
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100">今日の注目トピック</p>
        <p className="mt-2 text-lg font-bold sm:text-2xl">
          #{heroRank} {hero.name}のスコアが<span className="text-cyan-300">{hero.score.toFixed(1)}点</span>となり、議論が白熱しています。あなたはこれを妥当だと思いますか？
        </p>
      </section>

      <FilterBar
        ageGroup={ageGroup}
        party={party}
        gender={gender}
        house={house}
        query={query}
        parties={parties}
        showInactive={showInactive}
        inactiveCount={inactiveCount}
        onAgeGroupChange={setAgeGroup}
        onPartyChange={setParty}
        onGenderChange={setGender}
        onHouseChange={setHouse}
        onQueryChange={setQuery}
        onShowInactiveChange={setShowInactive}
      />

      <section id="ranking-feed" className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">ライブリーダーボード</p>
            <h2 className="text-2xl font-black sm:text-3xl">今の主導権を握るのは誰か？</h2>
          </div>
          <p className="text-sm text-slate-300">{activeFiltered.length}人がフィルターにマッチ</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {activeFiltered.map((item, idx) => (
            <RankingCard key={item.id} item={item} rank={idx + 1} />
          ))}
        </div>
      </section>

      {showInactive && inactiveFiltered.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/30 p-4">
            <span className="text-2xl">⚠</span>
            <div>
              <h2 className="text-xl font-black text-rose-200">発言ゼロ議員</h2>
              <p className="text-sm text-rose-300/80">
                過去90日間に国会での発言が確認できなかった議員 — {inactiveFiltered.length}名
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {inactiveFiltered.map((item, idx) => (
              <RankingCard key={item.id} item={item} rank={activeFiltered.length + idx + 1} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <h2 className="text-xl font-black">上昇中の政治家 🚀</h2>
          <div className="mt-3 space-y-2 text-sm">
            {rising.map((item) => (
              <p key={item.id}>
                <span className="font-bold">{item.name}</span> <span className="text-emerald-300">▲ +{item.rankDelta}位上昇</span>
              </p>
            ))}
          </div>
          <p className="mt-3 text-xs text-emerald-100/80">勢いのある話題はシェアを呼ぶ。次の更新前にあなたのピックを投稿しよう。</p>
        </div>

        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
          <h2 className="text-xl font-black">最大の急落 ⚠️</h2>
          <div className="mt-3 space-y-2 text-sm">
            {drops.map((item) => (
              <p key={item.id}>
                <span className="font-bold">{item.name}</span> <span className="text-rose-300">▼ {item.rankDelta}位下落</span>
              </p>
            ))}
          </div>
          <p className="mt-3 text-xs text-rose-100/80">急落は議論を呼ぶ。ランキングに異議を唱え、あなたの証拠をシェアしよう。</p>
        </div>

        <ShareCard politician={hero} rank={heroRank} />
      </section>
    </div>
  );
}
