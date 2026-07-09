import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchBill, type BillSponsorItem } from '@/lib/api-client';
import {
  BILL_ROLE_LABELS,
  billRoleLabel,
  billStatusLabel,
  billStatusTone,
  formatBillDate,
} from '@/lib/bills';
import { SITE_URL } from '@/lib/site';

// ISR: 動的セグメントのためビルド時 prerender されず、初回アクセスで描画し 300秒キャッシュ
// する（議員詳細ページと同じ。API へのビルド時依存を作らない安全な設定）。
export const revalidate = 300;

export async function generateMetadata(
  { params }: { params: Promise<{ code: string }> },
): Promise<Metadata> {
  const { code } = await params;
  const bill = await fetchBill(decodeURIComponent(code));
  if (!bill) return { title: '法案が見つかりません' };
  const statusLabel = billStatusLabel(bill.status);
  const title = `${bill.title}（${statusLabel}）`;
  const description = `${bill.title}の提出日・ステータス（${statusLabel}）・提出者一覧。国会議案データベースに基づく法案情報です。`.slice(0, 120);
  return {
    title,
    description,
    alternates: { canonical: `/bills/${encodeURIComponent(bill.bill_code)}` },
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary', title, description },
  };
}

// 役割の表示順: 提出者 → 賛成者・共同提出 → その他。
const ROLE_ORDER = ['primary', 'co', 'committee'];

function sponsorGroups(sponsors: BillSponsorItem[]): { role: string; label: string; items: BillSponsorItem[] }[] {
  const seen = new Set<string>();
  const roles = [
    ...ROLE_ORDER.filter((r) => sponsors.some((s) => s.role === r)),
    ...sponsors.map((s) => s.role).filter((r) => !ROLE_ORDER.includes(r)),
  ].filter((r) => (seen.has(r) ? false : (seen.add(r), true)));
  return roles.map((role) => ({
    role,
    label: BILL_ROLE_LABELS[role] ?? billRoleLabel(role),
    items: sponsors.filter((s) => s.role === role),
  }));
}

export default async function BillDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bill = await fetchBill(decodeURIComponent(code));
  if (!bill) notFound();

  const canonical = `${SITE_URL}/bills/${encodeURIComponent(bill.bill_code)}`;
  const groups = sponsorGroups(bill.sponsors);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Legislation',
        name: bill.title,
        legislationIdentifier: bill.bill_code,
        url: canonical,
        ...(bill.source_url ? { sameAs: bill.source_url } : {}),
        ...(bill.submitted_date ? { legislationDate: bill.submitted_date } : {}),
        ...(bill.passed_date ? { datePublished: bill.passed_date } : {}),
        legislationLegalForce:
          bill.status === 'passed' ? 'InForce' : 'NotInForce',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'トップ', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '法案・議案', item: `${SITE_URL}/bills` },
          { '@type': 'ListItem', position: 3, name: bill.title, item: canonical },
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
      <Link href="/bills" className="text-sm font-semibold text-accent hover:underline">
        ← 法案一覧に戻る
      </Link>

      <section className="rounded-3xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${billStatusTone(bill.status)}`}
          >
            {billStatusLabel(bill.status)}
          </span>
          <span className="text-xs text-muted">議案番号 {bill.bill_code}</span>
        </div>
        <h1 className="mt-3 text-2xl font-black leading-snug sm:text-3xl">{bill.title}</h1>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.2em] text-muted">提出日</dt>
            <dd className="mt-1 text-lg font-bold text-ink">{formatBillDate(bill.submitted_date)}</dd>
          </div>
          {bill.passed_date && (
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-muted">成立日</dt>
              <dd className="mt-1 text-lg font-bold text-ink">{formatBillDate(bill.passed_date)}</dd>
            </div>
          )}
        </dl>

        {bill.source_url && (
          <a
            href={bill.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            議案情報の一次資料を見る（外部サイト）
          </a>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-black">提出者・賛成者</h2>
          <p className="mt-1 text-sm text-muted">
            {bill.sponsors.length > 0
              ? `${bill.sponsors.length}名。名前から議員ページへたどれます。`
              : 'この法案には提出者データが登録されていません（閣法・予算等では提出者が省かれる場合があります）。'}
          </p>
        </div>

        {groups.map((g) => (
          <div key={g.role} className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="text-xs font-black uppercase tracking-[0.06em] text-accent">
              {g.label}
              <span className="ml-2 font-semibold text-muted">{g.items.length}名</span>
            </h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {g.items.map((s) => (
                <li key={s.politician_id}>
                  <Link
                    href={`/politicians/${s.politician_id}`}
                    className="inline-flex rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-muted hover:text-accent"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="text-xs text-muted">
        出典: 国会議案データベース（スマートニュース メディア研究所、MIT License）。一次情報は衆議院・参議院 公式「議案情報」。
      </p>
    </div>
  );
}
