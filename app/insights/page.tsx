import type { Metadata } from 'next';
import Link from 'next/link';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'データで読む国会',
  description:
    '公開データを集計して国会の活動を読み解く分析記事の一覧。提出法案データから見る立法活動、政党別のスコア分布などを、事実と分布で提示します。',
  alternates: { canonical: '/insights' },
};

const ARTICLES: { href: string; title: string; description: string }[] = [
  {
    href: '/insights/legislative-activity',
    title: '立法活動で見る国会 ― 提出法案データから読む',
    description:
      '国会に提出された法案のステータス分布、内閣提出と議員立法の内訳、立法実績スコアの高い議員を、本番データの集計で示します。',
  },
  {
    href: '/insights/party-score-distribution',
    title: '政党別に見る活動スコアの分布',
    description:
      '政党ごとの所属議員数と活動スコアの平均・中央値を一覧で比較します。優劣の断定はせず、分布として提示します。',
  },
];

export default function InsightsPage() {
  return (
    <ContentPage
      title="データで読む国会"
      lead={`${SITE_NAME}が集計した公開データをもとに、国会の活動を分布と事実で読み解く分析記事です。`}
      updated={CONTENT_UPDATED}
    >
      <ContentSection heading="このページの狙い">
        <p>
          個々の議員ページやランキングだけでは見えにくい、国会全体の傾向をデータの集計から
          読み解きます。各記事の数値は本番データベースから取得・集計した実測値で、特定の政党・
          候補者への投票を促す目的ではなく、有権者が自ら判断するための材料として提供します。
          政党間の優劣を断定するのではなく、分布として示すことを原則とします。
        </p>
      </ContentSection>

      <ContentSection heading="分析記事">
        <ul className="space-y-4">
          {ARTICLES.map((a) => (
            <li key={a.href} className="rounded-lg border border-line bg-surface p-4">
              <Link href={a.href} className="text-base font-bold text-ink hover:text-accent hover:underline">
                {a.title}
              </Link>
              <p className="mt-1.5 text-sm text-muted">{a.description}</p>
            </li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection heading="あわせて読みたい">
        <p>
          スコアの算出方法・データ出典は
          {' '}
          <Link href="/methodology" className="text-accent hover:underline">評価方法</Link>
          {' '}
          に、国会の仕組みの基礎解説は
          {' '}
          <Link href="/guide" className="text-accent hover:underline">解説・学ぶ</Link>
          {' '}
          にまとめています。法案の一覧は
          {' '}
          <Link href="/bills" className="text-accent hover:underline">法案・議案</Link>
          {' '}
          から、政党別の一覧は
          {' '}
          <Link href="/parties" className="text-accent hover:underline">政党別</Link>
          {' '}
          からご覧いただけます。
        </p>
      </ContentSection>
    </ContentPage>
  );
}
