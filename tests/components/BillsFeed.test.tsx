import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BillsFeed } from '@/components/BillsFeed';
import type { BillListItem } from '@/lib/api-client';

function makeBill(overrides: Partial<BillListItem> = {}): BillListItem {
  return {
    id: 1,
    bill_code: 'hr-衆法-221-1',
    title: 'サンプル法案',
    status: 'passed',
    submitted_date: '2026-05-01',
    sponsor_count: 3,
    ...overrides,
  };
}

const LIST: BillListItem[] = [
  makeBill({ id: 1, bill_code: 'a-1', title: '成立した法案', status: 'passed', submitted_date: '2026-05-10' }),
  makeBill({ id: 2, bill_code: 'a-2', title: '審議中の法案', status: 'in_committee', submitted_date: '2026-05-20' }),
  makeBill({ id: 3, bill_code: 'a-3', title: '撤回された法案', status: 'withdrawn', submitted_date: '2026-04-01', sponsor_count: 0 }),
];

describe('BillsFeed', () => {
  it('法案を提出日の新しい順に一覧表示し、詳細へリンクする', () => {
    render(<BillsFeed bills={LIST} />);
    const links = screen.getAllByRole('link');
    // 提出日降順: 審議中(5/20) → 成立(5/10) → 撤回(4/1)
    expect(links[0]).toHaveTextContent('審議中の法案');
    expect(links[0]).toHaveAttribute('href', '/bills/a-2');
    expect(screen.getByRole('link', { name: /成立した法案/ })).toHaveAttribute('href', '/bills/a-1');
  });

  it('ステータスタブで絞り込める', async () => {
    const user = userEvent.setup();
    render(<BillsFeed bills={LIST} />);
    // 初期は全件
    expect(screen.getByText('審議中の法案')).toBeInTheDocument();
    expect(screen.getByText('撤回された法案')).toBeInTheDocument();

    // 「成立」タブを押すと成立法案のみ
    await user.click(screen.getByRole('button', { name: /成立/ }));
    expect(screen.getByText('成立した法案')).toBeInTheDocument();
    expect(screen.queryByText('審議中の法案')).toBeNull();
    expect(screen.queryByText('撤回された法案')).toBeNull();
  });

  it('該当0件のステータスでは空メッセージを出す', async () => {
    const user = userEvent.setup();
    render(<BillsFeed bills={[makeBill({ status: 'passed' })]} />);
    await user.click(screen.getByRole('button', { name: /提出/ }));
    expect(screen.getByText('該当する法案がありません。')).toBeInTheDocument();
  });
});
