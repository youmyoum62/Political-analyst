import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/api-client', () => ({
  fetchBills: vi.fn(),
  fetchBill: vi.fn(),
}));

import { fetchBills, fetchBill } from '@/lib/api-client';
import BillsPage from '@/app/bills/page';
import BillDetailPage, { generateMetadata } from '@/app/bills/[code]/page';

const mockedList = vi.mocked(fetchBills);
const mockedDetail = vi.mocked(fetchBill);

beforeEach(() => {
  mockedList.mockReset();
  mockedDetail.mockReset();
});

describe('法案一覧ページ', () => {
  it('全件をページングで取得し、法案を詳細リンク付きで表示する', async () => {
    mockedList.mockResolvedValue({
      items: [
        { id: 1, bill_code: 'b-1', title: '第一の法案', status: 'passed', submitted_date: '2026-05-01', sponsor_count: 2 },
        { id: 2, bill_code: 'b-2', title: '第二の法案', status: 'in_committee', submitted_date: '2026-05-02', sponsor_count: 0 },
      ],
      total: 2,
    });
    render(await BillsPage());
    expect(screen.getByRole('heading', { level: 1, name: '法案・議案' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /第一の法案/ })).toHaveAttribute('href', '/bills/b-1');
    expect(screen.getByRole('link', { name: /第二の法案/ })).toHaveAttribute('href', '/bills/b-2');
    // total 以内で 1 ページで収まるため 1 回のみ呼ばれる
    expect(mockedList).toHaveBeenCalledTimes(1);
  });
});

describe('法案詳細ページ', () => {
  const bill = {
    id: 10,
    bill_code: 'hr-衆法-221-9',
    title: '刑事訴訟法の一部を改正する法律案',
    status: 'in_committee',
    submitted_date: '2026-05-15',
    passed_date: null,
    source_url: 'https://www.shugiin.go.jp/example',
    sponsors: [
      { politician_id: 7, name: '山田太郎', role: 'primary' },
      { politician_id: 9, name: '佐藤花子', role: 'co' },
    ],
  };

  it('法案名・ステータス・提出者を役割別に表示し議員ページへリンクする', async () => {
    mockedDetail.mockResolvedValue(bill);
    render(await BillDetailPage({ params: Promise.resolve({ code: encodeURIComponent(bill.bill_code) }) }));
    expect(screen.getByRole('heading', { level: 1, name: bill.title })).toBeInTheDocument();
    expect(screen.getByText('審議中')).toBeInTheDocument();
    // 役割グループの見出し（level 3）が提出者・賛成者の2つ出る
    const groupHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(groupHeadings).toHaveLength(2);
    expect(groupHeadings[0]).toHaveTextContent('提出者');
    expect(groupHeadings[1]).toHaveTextContent('賛成者・共同提出者');
    expect(screen.getByRole('link', { name: '山田太郎' })).toHaveAttribute('href', '/politicians/7');
    expect(screen.getByRole('link', { name: '佐藤花子' })).toHaveAttribute('href', '/politicians/9');
    // 一次資料リンク
    expect(screen.getByRole('link', { name: /一次資料/ })).toHaveAttribute('href', bill.source_url);
  });

  it('generateMetadata は法案名をタイトルに含める', async () => {
    mockedDetail.mockResolvedValue(bill);
    const meta = await generateMetadata({ params: Promise.resolve({ code: encodeURIComponent(bill.bill_code) }) });
    expect(String(meta.title)).toContain(bill.title);
  });

  it('存在しない法案は notFound を投げる', async () => {
    mockedDetail.mockResolvedValue(null);
    // next/navigation の notFound は例外を投げる
    await expect(
      BillDetailPage({ params: Promise.resolve({ code: 'missing' }) }),
    ).rejects.toThrow();
  });
});
