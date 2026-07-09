import { describe, it, expect } from 'vitest';

import type { BillListItem, PartySummary } from '@/lib/api-client';
import {
  billStatusDistribution,
  partiesSortedByAvg,
  partiesSortedByMembers,
  partyDistributionSummary,
  percentage,
  sponsorTypeBreakdown,
  statusDistributionWhere,
  topByLegislation,
} from '@/lib/insights';
import { makePolitician } from '../fixtures';

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

describe('percentage', () => {
  it('割合を小数第1位で返す', () => {
    expect(percentage(1, 4)).toBe(25);
    expect(percentage(1, 3)).toBe(33.3);
  });
  it('total<=0 のとき 0 を返す（ゼロ除算を避ける）', () => {
    expect(percentage(5, 0)).toBe(0);
  });
});

describe('billStatusDistribution', () => {
  const bills = [
    bill({ status: 'passed' }),
    bill({ status: 'passed' }),
    bill({ status: 'in_committee' }),
    bill({ status: 'submitted' }),
  ];

  it('BILL_STATUS_ORDER の順で存在するステータスのみ件数と割合を返す', () => {
    const dist = billStatusDistribution(bills);
    expect(dist.map((d) => d.status)).toEqual(['passed', 'in_committee', 'submitted']);
    expect(dist[0]).toEqual({ status: 'passed', count: 2, percentage: 50 });
    expect(dist[1]).toEqual({ status: 'in_committee', count: 1, percentage: 25 });
  });

  it('未知のステータスは末尾に件数の多い順で並べる', () => {
    const dist = billStatusDistribution([
      bill({ status: 'passed' }),
      bill({ status: 'zzz' }),
      bill({ status: 'zzz' }),
      bill({ status: 'yyy' }),
    ]);
    expect(dist.map((d) => d.status)).toEqual(['passed', 'zzz', 'yyy']);
  });

  it('空配列では空を返す', () => {
    expect(billStatusDistribution([])).toEqual([]);
  });
});

describe('sponsorTypeBreakdown', () => {
  it('sponsor_count 0 / 1 / 複数 を内閣提出・単独・複数に振り分ける', () => {
    const r = sponsorTypeBreakdown([
      bill({ sponsor_count: 0 }),
      bill({ sponsor_count: 0 }),
      bill({ sponsor_count: 1 }),
      bill({ sponsor_count: 5 }),
      bill({ sponsor_count: 20 }),
    ]);
    expect(r).toEqual({
      cabinetOrCommittee: 2,
      memberInitiated: 3,
      memberInitiatedSolo: 1,
      memberInitiatedMulti: 2,
      total: 5,
    });
  });
});

describe('statusDistributionWhere', () => {
  it('述語に一致する法案だけのステータス分布を返す', () => {
    const bills = [
      bill({ status: 'passed', sponsor_count: 0 }),
      bill({ status: 'passed', sponsor_count: 2 }),
      bill({ status: 'in_committee', sponsor_count: 3 }),
    ];
    const dist = statusDistributionWhere(bills, (b) => b.sponsor_count >= 1);
    expect(dist.map((d) => [d.status, d.count])).toEqual([
      ['passed', 1],
      ['in_committee', 1],
    ]);
  });
});

describe('topByLegislation', () => {
  it('legislation>0 のみをスコア降順で上位 n 名返す', () => {
    const pols = [
      makePolitician({ id: 1, metrics: { participation: 0, questionQuality: 0, legislation: 80, policyImpact: 0, influence: 0 } }),
      makePolitician({ id: 2, metrics: { participation: 0, questionQuality: 0, legislation: 0, policyImpact: 0, influence: 0 } }),
      makePolitician({ id: 3, metrics: { participation: 0, questionQuality: 0, legislation: 40, policyImpact: 0, influence: 0 } }),
    ];
    const top = topByLegislation(pols, 5);
    expect(top.map((p) => p.id)).toEqual([1, 3]);
  });

  it('同点は最終スコア降順で並べ、n で件数を絞る', () => {
    const pols = [
      makePolitician({ id: 1, score: 30, metrics: { participation: 0, questionQuality: 0, legislation: 50, policyImpact: 0, influence: 0 } }),
      makePolitician({ id: 2, score: 40, metrics: { participation: 0, questionQuality: 0, legislation: 50, policyImpact: 0, influence: 0 } }),
    ];
    expect(topByLegislation(pols, 1).map((p) => p.id)).toEqual([2]);
  });
});

describe('政党集計', () => {
  const parties = [
    party({ name: 'A', member_count: 40, avg_score: 15, representatives: 30, councillors: 10 }),
    party({ name: 'B', member_count: 10, avg_score: 25, representatives: 0, councillors: 10 }),
    party({ name: 'C', member_count: 10, avg_score: 20, representatives: 10, councillors: 0 }),
  ];

  it('partyDistributionSummary は合計と平均の範囲を返す', () => {
    expect(partyDistributionSummary(parties)).toEqual({
      partyCount: 3,
      totalMembers: 60,
      representatives: 40,
      councillors: 20,
      minAvg: 15,
      maxAvg: 25,
    });
  });

  it('partiesSortedByMembers は議員数の多い順、同数は平均降順', () => {
    expect(partiesSortedByMembers(parties).map((p) => p.name)).toEqual(['A', 'B', 'C']);
  });

  it('partiesSortedByAvg は平均の高い順', () => {
    expect(partiesSortedByAvg(parties).map((p) => p.name)).toEqual(['B', 'C', 'A']);
  });

  it('空配列でも壊れない', () => {
    expect(partyDistributionSummary([])).toEqual({
      partyCount: 0,
      totalMembers: 0,
      representatives: 0,
      councillors: 0,
      minAvg: 0,
      maxAvg: 0,
    });
  });
});
