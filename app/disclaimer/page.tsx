import type { Metadata } from 'next';
import Link from 'next/link';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED } from '@/lib/site';

export const metadata: Metadata = {
  title: '免責事項',
  description:
    '政治スコアメディアの免責事項。スコアは公開データから算出した暫定値であり、正確性・完全性を保証するものではありません。',
};

export default function DisclaimerPage() {
  return (
    <ContentPage title="免責事項" updated={CONTENT_UPDATED}>
      <ContentSection heading="スコアの性質">
        <p>
          当サイトが表示するスコア・順位は、公開データを基に当サイトが独自に算出した
          <strong className="text-ink">暫定値</strong>です。政治家個人の能力・資質・人格に対する
          評価や、支持・不支持を表明するものではありません。データの収集・評価は進行中であり、
          多くの評価軸がまだ十分に反映されていません。算出方法は
          {' '}
          <Link href="/methodology" className="text-accent hover:underline">評価方法</Link>
          {' '}をご確認ください。
        </p>
      </ContentSection>

      <ContentSection heading="正確性・完全性について">
        <p>
          データは公的な情報源から自動で収集していますが、その正確性・完全性・最新性を保証する
          ものではありません。元データの誤り、収集・処理上の不備、更新の遅れなどにより、実際の
          活動と異なる表示となる場合があります。掲載情報の利用によって生じたいかなる損害についても、
          当サイトは責任を負いません。
        </p>
      </ContentSection>

      <ContentSection heading="政治的中立性">
        <p>
          当サイトは特定の政党・政治団体・候補者を支持または反対するものではなく、いかなる政党・
          団体とも提携・関係していません。表示は事実データに基づく機械的な集計であり、特定の候補者
          への投票を促す意図はありません。
        </p>
      </ContentSection>

      <ContentSection heading="外部リンクについて">
        <p>
          当サイトは出典として外部サイトへのリンクを掲載しています。リンク先の内容について当サイトは
          管理責任を負わず、その正確性・適法性を保証するものではありません。
        </p>
      </ContentSection>

      <ContentSection heading="情報の訂正">
        <p>
          掲載内容に誤りを見つけられた場合は、
          {' '}
          <Link href="/about" className="text-accent hover:underline">このサイトについて</Link>
          {' '}のお問い合わせ先までご連絡ください。確認のうえ対応します。
        </p>
      </ContentSection>
    </ContentPage>
  );
}
