import type { Metadata } from 'next';
import Link from 'next/link';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'データ・編集方針',
  description:
    '政治スコアメディアのデータ出典・独立性・AIの利用方針・更新頻度を公開します。当サイトがどのように作られているかの透明性のためのページです。',
};

export default function EditorialPolicyPage() {
  return (
    <ContentPage
      title="データ・編集方針"
      lead={`${SITE_NAME}が「誰が・何に基づき・どう作っているか」を公開します。`}
      updated={CONTENT_UPDATED}
    >
      <ContentSection heading="独立性">
        <p>
          当サイトの記事的コンテンツ（要約・論評・解説）およびスコア算出は、特定の政党・政治
          団体・候補者からの資金提供や広告出稿の有無によって内容・評価を変えません。掲載順や
          評価を優遇する取引は一切行いません。特定の議員・政党の依頼を受けて記事やスコアを
          作成することもありません。独立性ポリシーの全体は
          {' '}
          <Link href="/about" className="text-accent hover:underline">このサイトについて</Link>
          {' '}をご覧ください。
        </p>
      </ContentSection>

      <ContentSection heading="データ出典">
        <ul className="space-y-2">
          <li>
            <span className="font-semibold text-ink">発言・会議データ：</span>
            国立国会図書館「国会会議録検索システム」API
          </li>
          <li>
            <span className="font-semibold text-ink">法案・議案データ：</span>
            スマートニュース メディア研究所「国会議案データベース」（MIT License）。
            一次情報は衆議院・参議院 公式「議案情報」
          </li>
          <li>
            <span className="font-semibold text-ink">役職・委員会名簿：</span>
            衆議院・参議院 公式サイト（委員会名簿）
          </li>
        </ul>
        <p>
          スコアの算出方法（評価軸・ウェイト・正規化の考え方）は
          {' '}
          <Link href="/methodology" className="text-accent hover:underline">評価方法</Link>
          {' '}のページで別途公開しています。
        </p>
      </ContentSection>

      <ContentSection heading="AIの使い方">
        <p>
          当サイトは、議員の活動データの要約・スコアに関する論評の生成にAIを活用しています。
          AIが生成・論評した文章には
          {' '}
          <span className="font-semibold text-ink">「AI生成」ラベル</span>
          {' '}を付し、根拠となる一次データの出典を明示します。運用にあたっては以下を原則とします。
        </p>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>AIの出力は公開データの範囲内に限定し、データに基づかない断定（政治家個人の人格・資質等への評価）は行いません。</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>一次資料からの引用・生データの表示と、AIによる要約・論評は区別して表示します。</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>AIの出力に誤りが見つかった場合は、後述の訂正方針に沿って確認・修正します。</span>
          </li>
        </ul>
      </ContentSection>

      <ContentSection heading="更新頻度">
        <p>
          国会会議録に基づく発言データとスコアの再計算は、自動化されたバッチ処理により
          <span className="font-semibold text-ink">毎日1回</span>
          実行しています。法案・役職（委員会名簿）データは年単位でしか変動しないため、
          運営者が随時手動で取り込みを行っています。いずれもデータ収集・評価の進捗に応じて
          スコア・順位が変動します。
        </p>
      </ContentSection>

      <ContentSection heading="免責・訂正">
        <p>
          掲載内容の正確性・完全性についての免責事項は
          {' '}
          <Link href="/disclaimer" className="text-accent hover:underline">免責事項</Link>
          {' '}をご覧ください。誤りの訂正申し立てや議員本人からのご連絡は
          {' '}
          <Link href="/corrections" className="text-accent hover:underline">訂正・お問い合わせ</Link>
          {' '}のページから受け付けています。
        </p>
      </ContentSection>
    </ContentPage>
  );
}
