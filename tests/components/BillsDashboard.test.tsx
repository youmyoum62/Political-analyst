import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { BillsDashboard } from '@/components/BillsDashboard';
import type { BillListItem, Digest } from '@/lib/api-client';
import { checkA11y } from '../fixtures';

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

const BILLS: BillListItem[] = [
  makeBill({ id: 1, bill_code: 'a-1', status: 'passed' }),
  makeBill({ id: 2, bill_code: 'a-2', status: 'passed' }),
  makeBill({ id: 3, bill_code: 'a-3', status: 'in_committee' }),
  makeBill({ id: 4, bill_code: 'a-4', status: 'submitted' }),
  makeBill({ id: 5, bill_code: 'a-5', status: 'withdrawn', sponsor_count: 0 }),
];

function makeDigest(overrides: Partial<Digest> = {}): Digest {
  return {
    generated_at: '2026-07-09T00:00:00',
    latest_activity_date: '2026-07-01',
    in_session: true,
    minutes: [],
    bills: [
      { id: 3, title: '審議中の法案', status: 'in_committee', date: '2026-06-30', source_url: 'https://shugiin.example/3' },
      { id: 99, title: '一覧に無い法案', status: 'submitted', date: '2026-06-28', source_url: null },
    ],
    ...overrides,
  };
}

describe('BillsDashboard', () => {
  it('ステータスサマリ（総数と各ステータス件数）を表示する', () => {
    render(<BillsDashboard bills={BILLS} digest={makeDigest()} />);
    // サマリのタイルは <dt> 要素（digest バッジの <span> と区別するため selector で限定）。
    const total = screen.getByText('総数', { selector: 'dt' }).closest('div');
    expect(total).toHaveTextContent('5');
    // 各ステータス（成立2 / 審議中1 / 提出1 / 撤回1）
    const passed = screen.getByText('成立', { selector: 'dt' }).closest('div');
    expect(passed).toHaveTextContent('2');
    const inCommittee = screen.getByText('審議中', { selector: 'dt' }).closest('div');
    expect(inCommittee).toHaveTextContent('1');
  });

  it('直近の法案の動きを、一覧に存在する id は詳細ページへ内部リンクする', () => {
    render(<BillsDashboard bills={BILLS} digest={makeDigest()} />);
    // id=3 は BILLS(a-3) に存在するのでリンク化される
    expect(screen.getByRole('link', { name: /審議中の法案/ })).toHaveAttribute(
      'href',
      '/bills/a-3',
    );
  });

  it('一覧に無い id はリンクせずテキスト表示にフォールバックする', () => {
    render(<BillsDashboard bills={BILLS} digest={makeDigest()} />);
    // id=99 は BILLS に無いのでリンクにならない
    expect(screen.queryByRole('link', { name: /一覧に無い法案/ })).toBeNull();
    expect(screen.getByText('一覧に無い法案')).toBeInTheDocument();
  });

  it('法案データが 0 件ならフォールバックメッセージを出す', () => {
    render(<BillsDashboard bills={[]} digest={makeDigest()} />);
    expect(screen.getByText(/現在表示できる法案データがありません/)).toBeInTheDocument();
  });

  it('digest が null なら「直近の動き」フォールバックを出す', () => {
    render(<BillsDashboard bills={BILLS} digest={null} />);
    expect(screen.getByText(/直近の法案の動きはまだありません/)).toBeInTheDocument();
    // サマリ（総数）は法案リストから描画される
    expect(screen.getByText('総数')).toBeInTheDocument();
  });

  it('閉会中は注記を表示する', () => {
    render(<BillsDashboard bills={BILLS} digest={makeDigest({ in_session: false })} />);
    expect(screen.getByText(/閉会中の可能性/)).toBeInTheDocument();
  });

  it('在会中は閉会中の注記を表示しない', () => {
    render(<BillsDashboard bills={BILLS} digest={makeDigest({ in_session: true })} />);
    expect(screen.queryByText(/閉会中の可能性/)).toBeNull();
  });

  it('a11y 違反がない', async () => {
    const { container } = render(<BillsDashboard bills={BILLS} digest={makeDigest()} />);
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
