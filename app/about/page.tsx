import type { Metadata } from 'next';
import Link from 'next/link';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED, SITE_CONTACT_EMAIL, SITE_DONATE_URL, SITE_NAME, SITE_OPERATOR } from '@/lib/site';

export const metadata: Metadata = {
  title: 'このサイトについて',
  description:
    '政治スコアメディアの目的・運営方針・独立性ポリシー。国会議員の活動を公開データから可視化し、有権者の判断材料を提供します。',
};

export default function AboutPage() {
  return (
    <ContentPage
      title="このサイトについて"
      lead={`${SITE_NAME}は、国会議員の活動を公開データから可視化する非営利的な個人プロジェクトです。`}
      updated={CONTENT_UPDATED}
    >
      <ContentSection heading="目的">
        <p>
          国会での質問・発言・立法・役職といった活動は公開されていますが、議員ごとに横断して
          比較するのは容易ではありません。当サイトは、公的に入手できるデータを集約・可視化し、
          有権者が自ら考えるための材料を提供することを目的としています。特定の政党・候補者への
          投票を促すものではありません。
        </p>
      </ContentSection>

      <ContentSection heading="独立性ポリシー">
        <ul className="space-y-2">
          <li>
            <span className="font-semibold text-ink">金銭で順位は動きません。</span>
            スコア・ランキングの掲載順は算出結果のみで決まり、政治家・政党からの支払いによって
            順位や表示を優遇することは一切ありません。
          </li>
          <li>
            <span className="font-semibold text-ink">政党からの資金を受けません。</span>
            特定の政党・政治団体からの資金提供や、掲載を条件とする広告は受け付けません。
          </li>
          <li>
            <span className="font-semibold text-ink">評価方法を公開します。</span>
            スコアの算出方法とデータ出典は
            {' '}
            <Link href="/methodology" className="text-accent hover:underline">評価方法</Link>
            {' '}
            のページで公開しています。
          </li>
        </ul>
      </ContentSection>

      <ContentSection heading="どう作られているか">
        <p>
          国立国会図書館「国会会議録検索システム」、衆議院・参議院の公式情報、スマートニュース
          メディア研究所「国会議案データベース」などの公開データを自動で収集し、独自のスコアを
          算出しています。データは暫定的で、収集の進捗に応じて更新されます。詳細は
          {' '}
          <Link href="/methodology" className="text-accent hover:underline">評価方法</Link>
          {' '}
          と
          {' '}
          <Link href="/disclaimer" className="text-accent hover:underline">免責事項</Link>
          {' '}
          をご覧ください。
        </p>
      </ContentSection>

      <ContentSection heading="運営者・お問い合わせ">
        {SITE_OPERATOR ? (
          <p>
            運営者: <span className="font-semibold text-ink">{SITE_OPERATOR}</span>
          </p>
        ) : (
          <p>運営者情報は準備中です。</p>
        )}
        {SITE_CONTACT_EMAIL ? (
          <p>
            データの誤り・ご意見・お問い合わせは{' '}
            <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="text-accent hover:underline">
              {SITE_CONTACT_EMAIL}
            </a>
            {' '}までご連絡ください。
          </p>
        ) : (
          <p>お問い合わせ窓口は準備中です。</p>
        )}
        {SITE_DONATE_URL && (
          <p>
            当サイトは無償で運営しています。
            <a
              href={SITE_DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              運営を支援する
            </a>
            （任意）ことができます。ご支援がスコアや掲載順に影響することはありません。
          </p>
        )}
      </ContentSection>
    </ContentPage>
  );
}
