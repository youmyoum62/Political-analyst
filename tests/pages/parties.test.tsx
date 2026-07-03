import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/api-client', () => ({
  fetchParties: vi.fn(),
  fetchPartyDetail: vi.fn(),
}));

import { fetchParties, fetchPartyDetail } from '@/lib/api-client';
import PartiesPage from '@/app/parties/page';
import PartyDetailPage from '@/app/parties/[name]/page';

const mockedList = vi.mocked(fetchParties);
const mockedDetail = vi.mocked(fetchPartyDetail);

describe('政党一覧ページ', () => {
  it('政党カードを人数・平均とともに表示し詳細へリンクする', async () => {
    mockedList.mockResolvedValue([
      { name: '自由民主党', member_count: 423, avg_score: 40.2, median_score: 38.0, representatives: 260, councillors: 163 },
    ]);
    render(await PartiesPage());
    expect(screen.getByRole('heading', { level: 2, name: '自由民主党' })).toBeInTheDocument();
    expect(screen.getByText('423名')).toBeInTheDocument();
    expect(screen.getByText('40.2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /自由民主党/ })).toHaveAttribute(
      'href',
      `/parties/${encodeURIComponent('自由民主党')}`,
    );
  });
});

describe('政党詳細ページ', () => {
  it('所属議員をスコア順に議員ページへのリンクで表示する', async () => {
    mockedDetail.mockResolvedValue({
      name: '自由民主党',
      member_count: 2,
      avg_score: 55.0,
      median_score: 55.0,
      representatives: 1,
      councillors: 1,
      members: [
        { id: 7, name: '山田太郎', house: 'representatives', final_score: 60.0, rank: 1 },
        { id: 9, name: '佐藤花子', house: 'councillors', final_score: 50.0, rank: 2 },
      ],
    });
    render(await PartyDetailPage({ params: Promise.resolve({ name: encodeURIComponent('自由民主党') }) }));
    expect(screen.getByRole('heading', { level: 1, name: '自由民主党' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /山田太郎/ })).toHaveAttribute('href', '/politicians/7');
    expect(screen.getByRole('link', { name: /佐藤花子/ })).toHaveAttribute('href', '/politicians/9');
  });
});
