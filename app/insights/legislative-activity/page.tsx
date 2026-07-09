import type { Metadata } from 'next';
import Link from 'next/link';

import { AiGeneratedLabel } from '@/components/AiGeneratedLabel';
import { ContentPage, ContentSection } from '@/components/ContentPage';
import { StatBarList, type StatBarItem } from '@/components/StatBarList';
import { fetchBills, fetchRankingSafe, type BillListItem } from '@/lib/api-client';
import { billStatusLabel, billStatusTone } from '@/lib/bills';
import {
  billStatusDistribution,
  percentage,
  sponsorTypeBreakdown,
  statusDistributionWhere,
  topByLegislation,
} from '@/lib/insights';
import { CONTENT_UPDATED, CONTENT_UPDATED_ISO, SITE_NAME, SITE_URL } from '@/lib/site';

// 集計は法案一覧とランキングのライブ取得に依存する。ビルド時 prerender で
// Render コールドスタートに当たると失敗しうるため、/bills・/parties と同じく
// force-dynamic にし、取得失敗時は空データ用の分岐で壊れないようにする。
export const dynamic = 'force-dynamic';

const CANONICAL = `${SITE_URL}/insights/legislative-activity`;

export const metadata: Metadata = {
  title: '立法活動で見る国会 ― 提出法案データから読む',
  description:
    '国会に提出された法案のステータス分布、内閣提出と議員立法の内訳、立法実績スコアの高い議員を、本番データの集計で読み解きます。数値は公開データからの実測値です。',
  alternates: { canonical: '/insights/legislative-activity' },
  openGraph: {
    title: '立法活動で見る国会 ― 提出法案データから読む',
    description: '提出法案データのステータス分布・提出者内訳・立法実績スコアを実測値で示す分析記事。',
    type: 'article',
  },
  twitter: { card: 'summary', title: '立法活動で見る国会 ― 提出法案データから読む' },
};

/**
 * 全法案を安全にページングで取得する。API の limit 上限は 200。
 * 取得失敗時は空配列を返し、記事を「データを取得できませんでした」の分岐で描画する
 * （sitemap の fetchBillCodesSafe と同じ思想。ページを 500 にしない）。
 */
async function fetchAllBillsSafe(): Promise<BillListItem[]> {
  const PAGE = 200;
  try {
    const first = await fetchBills({ limit: PAGE, offset: 0 });
    const items = [...first.items];
    let offset = PAGE;
    while (offset < first.total) {
      const page = await fetchBills({ limit: PAGE, offset });
      items.push(...page.items);
      offset += PAGE;
    }
    return items;
  } catch {
    return [];
  }
}

const STATUS_BAR_TONE: Record<string, string> = {
  passed: 'bg-up',
  in_committee: 'bg-accent',
  submitted: 'bg-accent2',
  withdrawn: 'bg-muted',
};

export default async function LegislativeActivityPage() {
  const [bills, ranking] = await Promise.all([fetchAllBillsSafe(), fetchRankingSafe()]);

  const hasBills = bills.length > 0;
  const statusDist = billStatusDistribution(bills);
  const sponsors = sponsorTypeBreakdown(bills);
  const memberBillStatus = statusDistributionWhere(bills, (b) => b.sponsor_count >= 1);
  const topLegislators = topByLegislation(ranking, 15);

  const statusBars: StatBarItem[] = statusDist.map((s) => ({
    key: s.status,
    label: billStatusLabel(s.status),
    value: s.count,
    valueLabel: `${s.count}件（${s.percentage}%）`,
    barClassName: STATUS_BAR_TONE[s.status] ?? 'bg-accent',
  }));

  const sponsorBars: StatBarItem[] = [
    {
      key: 'member',
      label: '議員立法（提出者データあり）',
      value: sponsors.memberInitiated,
      valueLabel: `${sponsors.memberInitiated}件（${percentage(sponsors.memberInitiated, sponsors.total)}%）`,
      barClassName: 'bg-accent',
    },
    {
      key: 'cabinet',
      label: '内閣提出・予算・委員会提出など（提出者データなし）',
      value: sponsors.cabinetOrCommittee,
      valueLabel: `${sponsors.cabinetOrCommittee}件（${percentage(sponsors.cabinetOrCommittee, sponsors.total)}%）`,
      barClassName: 'bg-muted',
    },
  ];

  const memberStatusBars: StatBarItem[] = memberBillStatus.map((s) => ({
    key: s.status,
    label: billStatusLabel(s.status),
    value: s.count,
    valueLabel: `${s.count}件（${s.percentage}%）`,
    barClassName: STATUS_BAR_TONE[s.status] ?? 'bg-accent',
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: '立法活動で見る国会 ― 提出法案データから読む',
    description:
      '国会に提出された法案のステータス分布、内閣提出と議員立法の内訳、立法実績スコアの高い議員を実測値で読み解く分析記事。',
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
        title="立法活動で見る国会 ― 提出法案データから読む"
        lead="国会に提出された法案データを集計し、ステータスの分布・提出者の内訳・立法実績スコアの高い議員を、事実として読み解きます。"
        updated={CONTENT_UPDATED}
      >
        {!hasBills ? (
          <ContentSection heading="データを取得できませんでした">
            <p>
              法案データの取得に失敗しました。時間をおいて再度お試しください。法案の一覧は
              {' '}
              <Link href="/bills" className="text-accent hover:underline">法案・議案</Link>
              {' '}
              からもご覧いただけます。
            </p>
          </ContentSection>
        ) : (
          <>
            <ContentSection heading="いま、何件の法案が動いているか">
              <p>
                本サイトが収録する法案は全{sponsors.total}件です。提出後の状態（ステータス）ごとの
                内訳は次のとおりで、成立したもの・委員会で審議中のものが大半を占めます。数値は
                公開データからの実測値です。
              </p>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <StatBarList items={statusBars} caption="法案のステータス別件数" />
              </div>
              <p className="text-xs text-muted">
                ステータスは「成立／審議中／提出／撤回」の4種で、衆議院・参議院公式の議案情報に基づきます。
                個々の法案は
                {' '}
                <Link href="/bills" className="text-accent hover:underline">法案・議案</Link>
                {' '}
                の一覧からステータスで絞り込んで確認できます。
              </p>
            </ContentSection>

            <ContentSection heading="誰が出した法案か ― 内閣提出と議員立法">
              <p>
                法案には、内閣が提出するもの（閣法）と、議員が提出するもの（議員立法）があります。
                本サイトのデータでは、提出者・賛成者が登録されている法案を議員立法の近似として
                扱えます。提出者データの有無で分けると次のようになります。
              </p>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <StatBarList items={sponsorBars} caption="提出者データの有無による法案の内訳" />
              </div>
              <p>
                提出者データのある{sponsors.memberInitiated}件のうち、提出者が1名のものが
                {sponsors.memberInitiatedSolo}件、複数名で提出・賛成しているものが
                {sponsors.memberInitiatedMulti}件です。議員立法は複数の議員が賛成者として名を連ねる
                ことが多く、共同での発議が一般的であることがうかがえます。法案が成立するまでの
                流れは
                {' '}
                <Link href="/guide/how-a-bill-becomes-law" className="text-accent hover:underline">
                  法案が成立するまで
                </Link>
                {' '}
                で解説しています。
              </p>
            </ContentSection>

            <ContentSection heading="議員立法はどこまで進んでいるか">
              <p>
                提出者データのある法案（議員立法）だけを取り出すと、ステータスの分布は次のとおりです。
                審議中の割合が高く、提出されても成立まで到達する法案は限られることが、分布から読み取れます。
              </p>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <StatBarList items={memberStatusBars} caption="議員立法のステータス別件数" />
              </div>
            </ContentSection>

            {topLegislators.length > 0 && (
              <ContentSection heading="立法実績スコアの高い議員">
                <p>
                  当サイトは、法案への関与などをもとに議員ごとの「立法実績スコア」を算出しています。
                  このスコアが高い議員は次のとおりです。これは提出件数そのものではなく、役割
                  （主提出・共同提出）や成立の有無を加味して算出した暫定スコアである点にご注意ください。
                </p>
                <ol className="space-y-1.5">
                  {topLegislators.map((p, i) => (
                    <li key={p.id}>
                      <Link
                        href={`/politicians/${p.id}`}
                        className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition hover:border-muted"
                      >
                        <span className="w-5 shrink-0 text-right text-sm font-black text-muted tabular-nums">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-bold text-ink">{p.name}</span>
                          <span className="ml-2 text-xs text-muted">{p.party}</span>
                        </span>
                        <span className="w-16 shrink-0 text-right text-xs text-muted">立法実績</span>
                        <span className="w-12 shrink-0 text-right font-black text-accent tabular-nums">
                          {p.metrics.legislation.toFixed(1)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <AiGeneratedLabel
                  label="スコアは自動算出（一次データに基づく暫定値）"
                  note="立法実績スコアは公開データを基に当サイトが算出した暫定値で、提出件数そのものではありません。算出方法の詳細は評価方法をご確認ください。"
                />
              </ContentSection>
            )}

            <ContentSection heading="このデータの限界">
              <p>
                本記事の集計にはいくつかの限界があります。読み解く際にご留意ください。
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  提出者データが登録されていない法案（sponsor_count が0の
                  {sponsors.cabinetOrCommittee}件）には、内閣提出（閣法）・予算・委員会提出などが
                  含まれます。これらを一律に「議員立法でない」とみなしているため、内閣提出と
                  それ以外の厳密な区別ではありません。
                </li>
                <li>
                  提出者・賛成者は「主提出（primary）」と「共同提出・賛成（co）」を区別していますが、
                  本記事の件数集計では両者をまとめて数えています。個々の役割は各法案ページで確認できます。
                </li>
                <li>
                  収録範囲は当サイトが取り込んだ期間の法案に限られ、国会に提出された全法案を
                  網羅するものではありません。ステータスは取得時点のもので、その後変動します。
                </li>
                <li>
                  「立法実績スコア」は各軸を重み付けした暫定スコアで、提出件数そのものではありません。
                </li>
              </ul>
              <p className="text-xs text-muted">
                出典: 国会議案データベース（スマートニュース メディア研究所、MIT License）。一次情報は
                衆議院・参議院 公式「議案情報」。スコアの算出方法は
                {' '}
                <Link href="/methodology" className="text-accent hover:underline">評価方法</Link>
                {' '}
                に、政党別の分布は
                {' '}
                <Link href="/insights/party-score-distribution" className="text-accent hover:underline">
                  政党別に見る活動スコアの分布
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
