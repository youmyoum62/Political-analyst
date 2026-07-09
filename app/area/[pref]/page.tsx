import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchRanking } from '@/lib/api-client';
import { extractPrefectures, findPrefecture } from '@/lib/district';
import { SITE_URL } from '@/lib/site';
import type { Politician } from '@/lib/types';

// 動的セグメントだが generateStaticParams は使わない（コードベース全体が API へのビルド時依存を
// 避ける方針で、bills/[code]・politicians/[id] と同じく初回アクセスで描画し ISR キャッシュする）。
export const revalidate = 300;

const houseLabel = (house: string) =>
  house === 'representatives' ? '衆' : house === 'councillors' ? '参' : house;

/** その都道府県の選挙区選出議員をスコア順で返す（比例代表は都道府県に紐づかないため含まない）。 */
function membersOf(ranking: Politician[], prefValue: string): Politician[] {
  return ranking
    .filter((p) => extractPrefectures(p.district).includes(prefValue))
    .sort((a, b) => b.score - a.score);
}

export async function generateMetadata(
  { params }: { params: Promise<{ pref: string }> },
): Promise<Metadata> {
  const { pref } = await params;
  const decoded = decodeURIComponent(pref);
  const prefecture = findPrefecture(decoded);
  if (!prefecture) return { title: '地域が見つかりません' };

  const title = `${prefecture.label}の国会議員一覧`;
  const description = `${prefecture.label}の選挙区から選出された国会議員の一覧と活動スコア。議員ごとの発言・立法などの活動を5軸で可視化した暫定スコアで並べています。`;
  return {
    title,
    description,
    alternates: { canonical: `/area/${encodeURIComponent(prefecture.value)}` },
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function AreaDetailPage({ params }: { params: Promise<{ pref: string }> }) {
  const { pref } = await params;
  const prefecture = findPrefecture(decodeURIComponent(pref));
  if (!prefecture) notFound();

  const ranking = await fetchRanking();
  const members = membersOf(ranking, prefecture.value);

  const canonical = `${SITE_URL}/area/${encodeURIComponent(prefecture.value)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${prefecture.label}の国会議員一覧`,
        url: canonical,
        about: `${prefecture.label}選出の国会議員`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'トップ', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '地域から探す', item: `${SITE_URL}/area` },
          { '@type': 'ListItem', position: 3, name: prefecture.label, item: canonical },
        ],
      },
    ],
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link href="/area" className="text-sm font-semibold text-accent hover:underline">
        ← 地域一覧に戻る
      </Link>

      <section className="rounded-3xl border border-line bg-surface p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">地域から探す</p>
        <h1 className="mt-1 text-3xl font-black sm:text-4xl">{prefecture.label}の国会議員</h1>
        <p className="mt-2 text-muted">
          {prefecture.label}の選挙区から選出された国会議員{members.length}名を、活動スコア順に掲載しています。
          比例代表選出の議員は特定の都道府県に紐づかないため、この一覧には含まれません。
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/ranking?pref=${encodeURIComponent(prefecture.value)}`}
            className="rounded-lg border border-line px-4 py-2 font-bold text-accent transition hover:border-muted"
          >
            全ランキングで{prefecture.label}を絞り込む →
          </Link>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-black">選出議員（スコア順）</h2>
        {members.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
            現在、{prefecture.label}の選挙区選出議員のデータが登録されていません。
          </p>
        ) : (
          <ul className="space-y-1.5">
            {members.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/politicians/${m.id}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition hover:border-muted"
                >
                  <span className="shrink-0 rounded-md border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-bold text-muted">
                    {houseLabel(m.house)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{m.name}</span>
                    <span className="ml-2 text-xs text-muted">
                      {m.party}
                      {m.district ? ` ・ ${m.district}` : ''}
                    </span>
                  </span>
                  <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(2, Math.min(100, m.score))}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right font-black text-accent">
                    {m.score.toFixed(1)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted">
        選挙区での絞り込みは現職の活動データに基づくものであり、特定候補への投票を推奨するものではありません。
        スコアは公開データから当サイトが独自に算出した暫定値です。算出方法は
        <Link href="/methodology" className="ml-1 text-accent underline-offset-2 hover:underline">
          評価方法
        </Link>
        をご覧ください。
      </p>
    </div>
  );
}
