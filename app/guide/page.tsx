import type { Metadata } from 'next';
import Link from 'next/link';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: '解説・学ぶ',
  description:
    '国会の仕組みとスコアの読み方を解説する記事一覧。スコアの見方、法案が成立するまでの流れ、国会用語集をまとめています。',
};

const GUIDES: { href: string; title: string; description: string }[] = [
  {
    href: '/guide/how-scores-work',
    title: 'スコアの読み方',
    description:
      '5つの評価軸が何を測っているか、役割によってウェイトが変わる理由、暫定値である意味をやさしく解説します。',
  },
  {
    href: '/guide/how-a-bill-becomes-law',
    title: '法案が成立するまで',
    description:
      '法案が国会に提出されてから成立するまでの流れを、委員会審議・本会議・衆参の関係を含めて解説します。',
  },
  {
    href: '/guide/glossary',
    title: '国会用語集',
    description: '会派・委員会・本会議・質問主意書など、国会報道でよく目にする用語を短くまとめました。',
  },
];

export default function GuidePage() {
  return (
    <ContentPage
      title="解説・学ぶ"
      lead={`${SITE_NAME}のスコアや、国会の仕組みそのものをより深く理解するための解説記事です。`}
      updated={CONTENT_UPDATED}
    >
      <ContentSection heading="このページの狙い">
        <p>
          国会議員の活動を数値で比較するには、前提となる国会の仕組みや、スコアが何を測っている
          かを理解しておくことが役立ちます。当サイトは特定の政党・候補者への投票を促す目的では
          なく、有権者が自ら判断するための材料を提供することを目的としています。以下の解説記事
          は、その判断材料を読み解くための基礎知識としてご利用ください。
        </p>
      </ContentSection>

      <ContentSection heading="解説記事">
        <ul className="space-y-4">
          {GUIDES.map((g) => (
            <li key={g.href} className="rounded-lg border border-line bg-surface p-4">
              <Link href={g.href} className="text-base font-bold text-ink hover:text-accent hover:underline">
                {g.title}
              </Link>
              <p className="mt-1.5 text-sm text-muted">{g.description}</p>
            </li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection heading="あわせて読みたい">
        <p>
          スコアの算出方法・データ出典を詳しく知りたい場合は
          {' '}
          <Link href="/methodology" className="text-accent hover:underline">評価方法</Link>
          {' '}
          のページをご覧ください。当サイトの運営方針は
          {' '}
          <Link href="/about" className="text-accent hover:underline">このサイトについて</Link>
          {' '}
          にまとめています。
        </p>
      </ContentSection>
    </ContentPage>
  );
}
