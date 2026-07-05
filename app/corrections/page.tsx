import type { Metadata } from 'next';
import Link from 'next/link';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED, SITE_CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: '訂正・お問い合わせ',
  description:
    '政治スコアメディアの掲載内容に誤りがあった場合の訂正方針と、議員ご本人・読者からのご連絡先を掲載します。',
};

export default function CorrectionsPage() {
  return (
    <ContentPage
      title="訂正・お問い合わせ"
      lead="掲載内容の誤りをご指摘いただく窓口と、訂正の考え方を公開します。"
      updated={CONTENT_UPDATED}
    >
      <ContentSection heading="訂正の方針">
        <p>
          {SITE_NAME}は公開データを自動収集して掲載しており、元データの誤り・収集処理上の
          不備・AIによる要約や論評の誤りなどにより、実際の活動と異なる表示となる場合があります。
          誤りをご指摘いただいた場合は、国会会議録・議案情報・衆参公式サイトなどの一次資料に
          当たって事実関係を確認したうえで、速やかに訂正します。訂正の要否や表現の見直しは、
          特定の政治的立場を有利・不利にする目的ではなく、正確性の観点のみから判断します。
        </p>
      </ContentSection>

      <ContentSection heading="訂正・ご連絡の申し立て方法">
        {SITE_CONTACT_EMAIL ? (
          <p>
            掲載内容の誤り、事実と異なる表示、その他ご意見・ご指摘は
            {' '}
            <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="text-accent hover:underline">
              {SITE_CONTACT_EMAIL}
            </a>
            {' '}まで、対象ページのURLと該当箇所を添えてご連絡ください。
          </p>
        ) : (
          <p>お問い合わせ窓口は準備中です。</p>
        )}
        <p>
          議員ご本人・議員事務所からのご連絡も歓迎します。役職・所属会派・スコアの根拠となる
          データに誤りがある場合は、確認可能な一次資料（公式サイトの掲載箇所など）を添えて
          いただけますと確認が迅速になります。
        </p>
      </ContentSection>

      <ContentSection heading="対応の流れ">
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>ご連絡いただいた内容について、一次資料（国会会議録・議案情報・衆参公式サイト等）で事実関係を確認します。</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>誤りが確認できた場合は、データまたは表示を訂正します。訂正の反映には、収集処理の都合上、一定の時間をいただく場合があります。</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>ご指摘の内容が確認できない、または見解の相違に留まる場合も、その旨をご連絡いたします。</span>
          </li>
        </ul>
      </ContentSection>

      <ContentSection heading="表現に関するご配慮のお願い">
        <p>
          当サイトのスコア・論評は公開データに基づく機械的な集計・AIによる分析であり、政治家
          個人の名誉を毀損する意図はありません。特定の記述が名誉・信用を不当に損なうおそれが
          あるとのご指摘があった場合は、他の申し立てより優先して速やかに内容を確認し、必要な
          修正・削除を行います。スコアの算出方法自体は
          {' '}
          <Link href="/methodology" className="text-accent hover:underline">評価方法</Link>
          {' '}を、免責事項は
          {' '}
          <Link href="/disclaimer" className="text-accent hover:underline">免責事項</Link>
          {' '}をご覧ください。
        </p>
      </ContentSection>
    </ContentPage>
  );
}
