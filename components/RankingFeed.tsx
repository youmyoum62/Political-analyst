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
  // スナップショットが2期以上たまり前回比の変動が存在する場合のみ trend 系UIを出す
  const hasTrendData = useMemo(() => ranking.some((p) => p.trend !== 0), [ranking]);

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

  const heroRank = hero.rank || 1;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
        <p className="font-bold">⚠ 暫定スコアについて</p>
        <p className="mt-1 text-amber-100/90">
          現在のスコアは<strong>出席・発言データを中心に算出した暫定値</strong>です。立法実績・政策実現・影響力・発言品質（AI評価）のデータは収集中で、多くの議員でまだ反映されていません。順位は確定的な評価ではありません。
        </p>
      </section>

      <section className="media-hero rounded-3xl p-5 sm:p-8">
        {hasTrendData && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-100">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-300" />
            ランク変動あり
          </div>
        )}
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">国会活動スコア</p>
        <h1 className="mt-2 text-4xl font-black leading-[0.95] sm:text-6xl md:text-7xl">
          日本の政治
          <br />
          パワーボード
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-100 sm:text-lg">
          国会での質問・発言・出席などの活動を5つの軸で可視化。議員同士を比較して傾向を確認できます。
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
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100">現在の暫定トップ</p>
        <p className="mt-2 text-lg font-bold sm:text-2xl">
          暫定スコア #{heroRank} は {hero.name}（<span className="text-cyan-300">{hero.score.toFixed(1)}点</span>）です。
          <span className="ml-1 text-sm font-normal text-amber-100/80">※出席・発言データ中心の暫定値</span>
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
          {activeFiltered.map((item) => (
            <RankingCard key={item.id} item={item} rank={item.rank} showTrend={hasTrendData} />
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
            {inactiveFiltered.map((item) => (
              <RankingCard key={item.id} item={item} rank={item.rank} showTrend={hasTrendData} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        {hasTrendData ? (
          <>
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <h2 className="text-xl font-black">上昇中の政治家 🚀</h2>
              <div className="mt-3 space-y-2 text-sm">
                {rising.length > 0 ? (
                  rising.map((item) => (
                    <p key={item.id}>
                      <span className="font-bold">{item.name}</span> <span className="text-emerald-300">▲ +{item.rankDelta}位上昇</span>
                    </p>
                  ))
                ) : (
                  <p className="text-emerald-100/70">該当なし</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
              <h2 className="text-xl font-black">順位を下げた政治家</h2>
              <div className="mt-3 space-y-2 text-sm">
                {drops.length > 0 ? (
                  drops.map((item) => (
                    <p key={item.id}>
                      <span className="font-bold">{item.name}</span> <span className="text-rose-300">▼ {item.rankDelta}位下落</span>
                    </p>
                  ))
                ) : (
                  <p className="text-rose-100/70">該当なし</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 lg:col-span-2">
            <h2 className="text-xl font-black">ランク変動（前回比）</h2>
            <p className="mt-2 text-sm text-slate-400">
              スコアのスナップショットがまだ1期分のため、前回比の変動は集計できません。
              データが2期以上たまると、上昇・下落の動きを表示します。
            </p>
          </div>
        )}

        <ShareCard politician={hero} rank={heroRank} />
      </section>
    </div>
  );
}
