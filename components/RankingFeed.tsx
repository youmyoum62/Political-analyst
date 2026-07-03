'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DietActivityFeed } from '@/components/DietActivityFeed';
import { FilterBar } from '@/components/FilterBar';
import { RankingCard } from '@/components/RankingCard';
import { ShareCard } from '@/components/ShareCard';
import { AgeGroup, HouseFilter, filterPoliticians, getBiggestDrops, getParties, getRankedPoliticians, getRisingPoliticians } from '@/lib/api';
import { Digest } from '@/lib/api-client';
import { Politician } from '@/lib/types';

export function RankingFeed({
  ranking,
  limit,
  digest,
}: {
  ranking: Politician[];
  limit?: number;
  digest?: Digest | null;
}) {
  // limit 指定時（トップページ）は上位N件のみのプレビュー表示。フィルタと発言データなし欄は
  // 全件ページ（/ranking）側に集約し、プレビューでは出さない（絞り込みが全件リンクに
  // 引き継がれない矛盾・機能しないトグルを避けるため）。
  const isLimited = typeof limit === 'number';

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

  const displayedActive = isLimited ? activeFiltered.slice(0, limit) : activeFiltered;
  const hasMore = isLimited && activeFiltered.length > (limit as number);

  const hero = activeFiltered[0] ?? sorted.find((p) => !p.isInactive) ?? sorted[0];

  if (!hero) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h1 className="text-2xl font-black text-ink">ランキングデータがありません</h1>
        <p className="mt-2 text-sm text-muted">
          バックエンド API は空のランキングを返しました。代替データは表示していません。
        </p>
      </section>
    );
  }

  const heroRank = hero.rank || 1;

  return (
    <div className="space-y-6">
      <section className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent2 text-[10px] font-bold text-accent2">i</span>
        <p className="text-muted">
          <strong className="font-bold text-ink">暫定スコアについて。</strong>
          {' '}現在のスコアは出席・発言データを中心に算出した暫定値です。立法実績・政策実現・影響力・発言品質（AI評価）のデータは収集中で、多くの議員でまだ反映されていません。順位は確定的な評価ではありません。
        </p>
      </section>

      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-8">
        {hasTrendData && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-muted">
            ランク変動あり
          </div>
        )}
        <p className="text-xs uppercase tracking-[0.3em] text-accent">国会活動データ・{new Date().getFullYear()}年更新</p>
        <h1 className="mt-2 text-4xl font-black leading-[0.95] sm:text-6xl md:text-7xl">
          国会議員
          <br />
          活動スコア
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-lg">
          国会での質問・発言・出席などの活動を5つの軸で可視化。議員同士を比較して傾向を確認できます。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/compare" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-canvas transition hover:opacity-90">
            議員を比較する
          </Link>
          <a href="#ranking-feed" className="rounded-lg border border-line px-5 py-2.5 text-sm font-bold transition hover:bg-white/5">
            ランキングを見る
          </a>
        </div>
      </section>

      {digest && <DietActivityFeed digest={digest} />}

      <section className="flex items-baseline justify-between rounded-2xl border border-line bg-surface p-4">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted">暫定トップ</span>
        <p className="text-lg font-bold sm:text-2xl">
          #{heroRank} {hero.name}（<span className="text-accent">{hero.score.toFixed(1)}点</span>）
          <span className="ml-1 text-sm font-normal text-muted">※出席・発言データ中心の暫定値</span>
        </p>
      </section>

      {!isLimited && (
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
      )}

      <section id="ranking-feed" className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">ライブリーダーボード</p>
            <h2 className="text-2xl font-black sm:text-3xl">{isLimited ? `暫定トップ${limit}` : 'ランキング'}</h2>
          </div>
          <p className="text-sm text-muted">
            {isLimited ? `上位${displayedActive.length}名を表示` : `${activeFiltered.length}人がフィルターにマッチ`}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {displayedActive.map((item) => (
            <RankingCard key={item.id} item={item} rank={item.rank} showTrend={hasTrendData} />
          ))}
        </div>

        {hasMore && (
          <Link
            href="/ranking"
            className="flex items-center justify-center rounded-2xl border border-line bg-surface p-4 text-sm font-bold text-accent transition hover:border-muted"
          >
            全{activeFiltered.length}名のランキングを見る →
          </Link>
        )}
      </section>

      {!isLimited && showInactive && inactiveFiltered.length > 0 && (
        <section className="space-y-3">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-xl font-black">発言データなしの議員</h2>
            <p className="text-sm text-muted">
              過去90日間に国会での発言が確認できなかった議員 — {inactiveFiltered.length}名
            </p>
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
            <div className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-xl font-black">順位が上昇</h2>
              <div className="mt-3 space-y-2 text-sm">
                {rising.length > 0 ? (
                  rising.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="font-bold">{item.name}</span>
                      <span className="rounded-full bg-up/10 px-2 py-0.5 text-xs font-bold text-up">▲ +{item.rankDelta}位</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">該当なし</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-xl font-black">順位が下落</h2>
              <div className="mt-3 space-y-2 text-sm">
                {drops.length > 0 ? (
                  drops.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="font-bold">{item.name}</span>
                      <span className="rounded-full bg-down/10 px-2 py-0.5 text-xs font-bold text-down">▼ {item.rankDelta}位</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">該当なし</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-4 lg:col-span-2">
            <h2 className="text-xl font-black">ランク変動（前回比）</h2>
            <p className="mt-2 text-sm text-muted">
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
