import type { Metadata } from 'next';
import Link from 'next/link';

import { fetchRanking } from '@/lib/api-client';
import { PREFECTURES, extractPrefectures } from '@/lib/district';

// 全議員ランキングを都度集計する。動的セグメントの詳細ページと同じ ISR キャッシュ方針。
export const revalidate = 300;

export const metadata: Metadata = {
  title: '都道府県から国会議員を探す',
  description:
    '47都道府県ごとの国会議員一覧ページ。お住まいの地域の選挙区から選出された議員の活動スコアを確認できます。スコアは公開データから算出した暫定値です。',
  alternates: { canonical: '/area' },
};

export default async function AreaIndexPage() {
  const ranking = await fetchRanking();

  // 選挙区選出議員を都道府県ごとに数える（比例代表は都道府県に紐づかないため含まない）。
  const counts = new Map<string, number>();
  for (const p of ranking) {
    for (const pref of extractPrefectures(p.district)) {
      counts.set(pref, (counts.get(pref) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line bg-surface p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">地域から探す</p>
        <h1 className="text-3xl font-black sm:text-5xl">都道府県から国会議員を探す</h1>
        <p className="mt-2 text-muted">
          都道府県を選ぶと、その地域の選挙区から選出された国会議員の一覧と活動スコアを確認できます。
          比例代表選出の議員は特定の都道府県に紐づかないため、各地域ページには含まれません。
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {PREFECTURES.map((p) => {
          const count = counts.get(p.value) ?? 0;
          return (
            <Link
              key={p.value}
              href={`/area/${encodeURIComponent(p.value)}`}
              className="flex items-baseline justify-between gap-2 rounded-2xl border border-line bg-surface p-4 transition hover:border-muted"
            >
              <span className="text-base font-black text-ink">{p.label}</span>
              <span className="shrink-0 text-sm text-muted">{count}名</span>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        議員数は選挙区選出の現職議員の数です。選挙区での絞り込みは現職の活動データに基づくものであり、
        特定候補への投票を推奨するものではありません。スコアは公開データから当サイトが独自に算出した暫定値です。
      </p>
    </div>
  );
}
