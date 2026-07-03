import type { Metadata } from 'next';
import Link from 'next/link';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED, SITE_CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'プライバシーポリシー',
  description:
    '政治スコアメディアのプライバシーポリシー。アクセス情報の取り扱い、Cookie、アクセス解析・広告について説明します。',
};

export default function PrivacyPage() {
  return (
    <ContentPage
      title="プライバシーポリシー"
      lead="当サイトにおける利用者情報の取り扱いについて定めます。"
      updated={CONTENT_UPDATED}
    >
      <ContentSection heading="取得する情報">
        <p>
          当サイトは会員登録を必要とせず、氏名・メールアドレスなどの個人情報を利用者に入力して
          いただくことはありません。サイトの提供にあたり、ホスティング事業者（Vercel）を通じて
          アクセスに関する技術情報（IPアドレス、ブラウザの種類、参照元、アクセス日時など）が
          自動的に記録される場合があります。これらはサイトの運用・不正防止・品質改善のために
          用います。
        </p>
      </ContentSection>

      <ContentSection heading="Cookie（クッキー）">
        <p>
          当サイトは現在、サイトの基本的な表示に必要な範囲を超えて Cookie を積極的に利用しては
          いません。今後、アクセス解析や広告配信を導入する場合は、それらのサービスが Cookie 等を
          使用することがあります。導入時には本ポリシーを更新し、この項目に明記します。
        </p>
      </ContentSection>

      <ContentSection heading="アクセス解析・広告について">
        <p>
          当サイトでは、将来的にアクセス解析ツールや広告配信サービス（例: Google アナリティクス、
          Google AdSense 等）を導入する可能性があります。これらのサービスは、利用者の興味に応じた
          表示のために Cookie や識別子を使用し、匿名のトラフィックデータを収集することがあります。
          収集される情報は各サービス提供者のプライバシーポリシーに従って取り扱われます。導入した
          際には、本ページで対象サービスと無効化（オプトアウト）の方法を案内します。
        </p>
      </ContentSection>

      <ContentSection heading="第三者への提供">
        <p>
          当サイトは、法令に基づく場合を除き、取得した情報を利用者本人の同意なく第三者へ販売・
          提供することはありません。
        </p>
      </ContentSection>

      <ContentSection heading="お問い合わせ">
        {SITE_CONTACT_EMAIL ? (
          <p>
            本ポリシーに関するお問い合わせは{' '}
            <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="text-accent hover:underline">
              {SITE_CONTACT_EMAIL}
            </a>
            {' '}までご連絡ください。
          </p>
        ) : (
          <p>
            お問い合わせ窓口は準備中です。連絡先の詳細は
            {' '}
            <Link href="/about" className="text-accent hover:underline">このサイトについて</Link>
            {' '}に掲載します。
          </p>
        )}
      </ContentSection>

      <ContentSection heading="改定">
        <p>
          本ポリシーは、法令の変更やサービス内容の変更に応じて予告なく改定することがあります。
          改定後の内容は本ページに掲載した時点で効力を生じます。
        </p>
      </ContentSection>
    </ContentPage>
  );
}
