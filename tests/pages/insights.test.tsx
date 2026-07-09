import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/api-client', () => ({
  fetchBills: vi.fn(),
  fetchRankingSafe: vi.fn(),
  fetchParties: vi.fn(),
}));

import { fetchBills, fetchRankingSafe, fetchParties } from '@/lib/api-client';
import type { BillListItem, PartySummary } from '@/lib/api-client';
import InsightsIndexPage from '@/app/insights/page';
import LegislativeActivityPage from '@/app/insights/legislative-activity/page';
import PartyScoreDistributionPage from '@/app/insights/party-score-distribution/page';
import { makePolitician } from '../fixtures';

const mockedBills = vi.mocked(fetchBills);
const mockedRanking = vi.mocked(fetchRankingSafe);
const mockedParties = vi.mocked(fetchParties);

const bill = (o: Partial<BillListItem>): BillListItem => ({
  id: 1,
  bill_code: 'b-1',
  title: '法案',
  status: 'passed',
  submitted_date: '2026-05-01',
  sponsor_count: 0,
  ...o,
});

const party = (o: Partial<PartySummary>): PartySummary => ({
  name: '政党',
  member_count: 10,
  avg_score: 20,
  median_score: 20,
  representatives: 5,
  councillors: 5,
  ...o,
});

beforeEach(() => {
  mockedBills.mockReset();
  mockedRanking.mockReset();
  mockedParties.mockReset();
});

describe('分析記事インデックス', () => {
  it('2本の記事へのリンクを表示する', () => {
    render(<InsightsIndexPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'データで読む国会' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /立法活動で見る国会/ })).toHaveAttribute(
      'href',
      '/insights/legislative-activity',
    );
    expect(screen.getByRole('link', { name: /政党別に見る活動スコアの分布/ })).toHaveAttribute(
      'href',
      '/insights/party-score-distribution',
    );
  });
});

describe('立法活動の記事', () => {
  it('ステータス分布と立法実績スコア上位議員を議員リンク付きで表示する', async () => {
    mockedBills.mockResolvedValue({
      items: [
        bill({ bill_code: 'a', status: 'passed', sponsor_count: 0 }),
        bill({ bill_code: 'b', status: 'passed', sponsor_count: 2 }),
        bill({ bill_code: 'c', status: 'in_committee', sponsor_count: 3 }),
        bill({ bill_code: 'd', status: 'in_committee', sponsor_count: 1 }),
      ],
      total: 4,
    });
    mockedRanking.mockResolvedValue([
      makePolitician({ id: 7, name: '立法花子', party: 'X党', metrics: { participation: 0, questionQuality: 0, legislation: 80, policyImpact: 0, influence: 0 } }),
      makePolitician({ id: 8, name: '無関与太郎', party: 'Y党', metrics: { participation: 0, questionQuality: 0, legislation: 0, policyImpact: 0, influence: 0 } }),
    ]);

    render(await LegislativeActivityPage());

    expect(screen.getByRole('heading', { level: 1, name: /立法活動で見る国会/ })).toBeInTheDocument();
    // 全体分布では成立・審議中とも2件（50%）のため、ラベルはちょうど2箇所に出る
    // （議員立法のみの分布は 1件/2件 の33%/67%になるので、ここには混ざらない）
    expect(screen.getAllByText('2件（50%）')).toHaveLength(2);
    // 提出者データの有無の内訳（議員立法3件=75% / 提出者なし1件=25%）
    expect(screen.getByText('3件（75%）')).toBeInTheDocument();
    expect(screen.getByText('1件（25%）')).toBeInTheDocument();
    // 立法実績上位に legislation>0 の議員のみ、リンク付きで出る
    expect(screen.getByRole('link', { name: /立法花子/ })).toHaveAttribute('href', '/politicians/7');
    expect(screen.queryByRole('link', { name: /無関与太郎/ })).toBeNull();
  });

  it('法案取得に失敗しても 500 にせずフォールバック文言を出す', async () => {
    mockedBills.mockRejectedValue(new Error('API down'));
    mockedRanking.mockResolvedValue([]);

    render(await LegislativeActivityPage());

    expect(screen.getByRole('heading', { name: 'データを取得できませんでした' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '法案・議案' })).toHaveAttribute('href', '/bills');
  });
});

describe('政党別分布の記事', () => {
  it('政党を表で表示し各政党ページへリンクする', async () => {
    mockedParties.mockResolvedValue([
      party({ name: '第一党', member_count: 40, avg_score: 15, median_score: 14 }),
      party({ name: '第二党', member_count: 10, avg_score: 25, median_score: 24 }),
    ]);

    render(await PartyScoreDistributionPage());

    expect(screen.getByRole('heading', { level: 1, name: '政党別に見る活動スコアの分布' })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /第一党/ });
    expect(links[0]).toHaveAttribute('href', `/parties/${encodeURIComponent('第一党')}`);
    expect(screen.getAllByRole('link', { name: /第二党/ })[0]).toHaveAttribute(
      'href',
      `/parties/${encodeURIComponent('第二党')}`,
    );
    // 表に平均スコアが出る（第二党の平均 25.0）
    expect(screen.getAllByText('25.0').length).toBeGreaterThan(0);
  });

  it('政党取得に失敗してもフォールバック文言を出す', async () => {
    mockedParties.mockRejectedValue(new Error('API down'));

    render(await PartyScoreDistributionPage());

    expect(screen.getByRole('heading', { name: 'データを取得できませんでした' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '政党別' })).toHaveAttribute('href', '/parties');
  });
});
