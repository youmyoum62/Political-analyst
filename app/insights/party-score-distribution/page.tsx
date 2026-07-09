import type { Metadata } from 'next';
import Link from 'next/link';

import { AiGeneratedLabel } from '@/components/AiGeneratedLabel';
import { ContentPage, ContentSection } from '@/components/ContentPage';
import { StatBarList, type StatBarItem } from '@/components/StatBarList';
import { fetchParties, type PartySummary } from '@/lib/api-client';
import {
  partiesSortedByAvg,
  partiesSortedByMembers,
  partyDistributionSummary,
} from '@/lib/insights';
import { CONTENT_UPDATED, CONTENT_UPDATED_ISO, SITE_NAME, SITE_URL } from '@/lib/site';

// /parties と同じく force-dynamic（ライブ集計をビルド時 prerender に依存させない）。
export const dynamic = 'force-dynamic';

const CANONICAL = `${SITE_URL}/insights/party-score-distribution`;

export const metadata: Metadata = {
  title: '政党別に見る活動スコアの分布',
  description:
    '政党ごとの所属議員数と活動スコアの平均・中央値を一覧で比較する分析記事。優劣を断定せず、公開データからの実測値を分布として提示します。',
  alternates: { canonical: '/insights/party-score-distribution' },
  openGraph: {
    title: '政党別に見る活動スコアの分布',
    description: '政党ごとの議員数・平均/中央値スコアを分布として示す分析記事。',
    type: 'article',
  },
  twitter: { card: 'summary', title: '政党別に見る活動スコアの分布' },
};

async function fetchPartiesSafe(): Promise<PartySummary[]> {
  try {
    return await fetchParties();
  } catch {
    return [];
  }
}

const houseSummary = (reps: number, coun: number) => {
  const parts: string[] = [];
  if (reps) parts.push(`衆${reps}`);
  if (coun) parts.push(`参${coun}`);
  return parts.join('・') || '—';
};

export default async function PartyScoreDistributionPage() {
  const parties = await fetchPartiesSafe();
  const hasData = parties.length > 0;

  const summary = partyDistributionSummary(parties);
  const byMembers = partiesSortedByMembers(parties);
  const byAvg = partiesSortedByAvg(parties);

  // 平均スコアのバーは、分布の広がりが見えるよう最大平均値を基準にする。
  const avgBars: StatBarItem[] = byAvg.map((p) => ({
    key: p.name,
    label: p.name,
    value: p.avg_score,
    valueLabel: `平均 ${p.avg_score.toFixed(1)} ・ 中央値 ${p.median_score.toFixed(1)} ・ ${p.member_count}名`,
    href: `/parties/${encodeURIComponent(p.name)}`,
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: '政党別に見る活動スコアの分布',
    description:
      '政党ごとの所属議員数と活動スコアの平均・中央値を分布として示す分析記事。優劣は断定しない。',
    inLanguage: 'ja',
    isAccessibleForFree: true,
    datePublished: CONTENT_UPDATED_ISO,
    dateModified: CONTENT_UPDATED_ISO,
    mainEntityOfPage: CANONICAL,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ContentPage
        title="政党別に見る活動スコアの分布"
        lead="政党ごとの所属議員数と活動スコアの平均・中央値を、公開データの実測値で比較します。政党間の優劣を示すものではなく、分布として提示します。"
        updated={CONTENT_UPDATED}
      >
        {!hasData ? (
          <ContentSection heading="データを取得できませんでした">
            <p>
              政党データの取得に失敗しました。時間をおいて再度お試しください。政党別の一覧は
              {' '}
              <Link href="/parties" className="text-accent hover:underline">政党別</Link>
              {' '}
              からもご覧いただけます。
            </p>
          </ContentSection>
        ) : (
          <>
            <ContentSection heading="全体像">
              <p>
                本サイトが集計する政党・会派は{summary.partyCount}、所属議員は合計
                {summary.totalMembers}名（衆議院{summary.representatives}名・参議院
                {summary.councillors}名）です。各政党の平均スコアは{summary.minAvg.toFixed(1)}点から
                {summary.maxAvg.toFixed(1)}点の範囲に分布しています。スコアは公開データから算出した
                暫定値で、政党の優劣を示すものではありません。
              </p>
            </ContentSection>

            <ContentSection heading="所属議員数の多い政党">
              <p>
                所属議員数の多い順に並べると次のようになります。議員数の多い政党ほど、平均・中央値は
                所属議員全体の傾向を表しやすくなります。政党名から各政党の議員一覧へたどれます。
              </p>
              <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th scope="col" className="px-4 py-3 font-semibold">政党・会派</th>
                      <th scope="col" className="px-4 py-3 font-semibold">内訳</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">議員数</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">平均</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">中央値</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMembers.map((p) => (
                      <tr key={p.name} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/parties/${encodeURIComponent(p.name)}`}
                            className="font-semibold text-ink hover:text-accent hover:underline"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted">{houseSummary(p.representatives, p.councillors)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink">{p.member_count}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-accent">
                          {p.avg_score.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {p.median_score.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ContentSection>

            <ContentSection heading="平均スコアの分布">
              <p>
                各政党の平均スコアを高い順に並べたものです。棒の長さは平均スコアの相対的な大きさを
                表します。少人数の会派は数名のスコアで平均が大きく動くため、議員数とあわせて
                読むことが大切です。これは分布の目安であり、政党間の優劣を示すものではありません。
              </p>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <StatBarList items={avgBars} caption="政党ごとの平均スコア" />
              </div>
              <AiGeneratedLabel
                label="スコアは自動算出（一次データに基づく暫定値）"
                note="スコアは公開データを基に当サイトが算出した暫定値です。出席・発言データが中心で、政党の優劣を示すものではありません。算出方法は評価方法をご確認ください。"
              />
            </ContentSection>

            <ContentSection heading="読み解くうえでの注意">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  スコアは出席・発言データを中心とした暫定値で、政党の政策や理念の評価ではありません。
                </li>
                <li>
                  少人数の会派は、わずかな人数のスコアで平均・中央値が大きく変動します。議員数を
                  あわせてご覧ください。
                </li>
                <li>
                  会派名は公開データのままで、一部に表記ゆれや要精査の値が含まれる場合があります。
                </li>
              </ul>
              <p className="text-xs text-muted">
                スコアの算出方法は
                {' '}
                <Link href="/methodology" className="text-accent hover:underline">評価方法</Link>
                {' '}
                に、政党ごとの議員一覧は
                {' '}
                <Link href="/parties" className="text-accent hover:underline">政党別</Link>
                {' '}
                に、立法活動の集計は
                {' '}
                <Link href="/insights/legislative-activity" className="text-accent hover:underline">
                  立法活動で見る国会
                </Link>
                {' '}
                にまとめています。
              </p>
            </ContentSection>
          </>
        )}
      </ContentPage>
    </>
  );
}
