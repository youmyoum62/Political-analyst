import type { Metadata } from 'next';

import { BillsFeed } from '@/components/BillsFeed';
import { fetchBills, type BillListItem } from '@/lib/api-client';

// force-dynamic を維持（ranking/parties と同理由: Render コールドスタート中の
// ビルド時 prerender 失敗を避け、都度 fetch で全件を返す。keep-warm 稼働中）。
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '法案・議案一覧',
  description:
    '国会に提出された法案の一覧。成立・審議中・提出・撤回のステータスで絞り込み、提出者から議員ページへたどれます。データは衆議院・参議院公式の議案情報に基づきます。',
  alternates: { canonical: '/bills' },
  openGraph: { title: '法案・議案一覧', type: 'website' },
};

// API の limit 上限は 200。全件（約532件）を取得するためページングして結合する。
async function fetchAllBills(): Promise<BillListItem[]> {
  const PAGE = 200;
  const first = await fetchBills({ limit: PAGE, offset: 0 });
  const items = [...first.items];
  let offset = PAGE;
  while (offset < first.total) {
    const page = await fetchBills({ limit: PAGE, offset });
    items.push(...page.items);
    offset += PAGE;
  }
  return items;
}

export default async function BillsPage() {
  const bills = await fetchAllBills();
  return <BillsFeed bills={bills} />;
}
