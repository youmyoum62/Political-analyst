/**
 * 分析記事（/insights）で使う集計ユーティリティ。
 *
 * すべて純関数として実装し、テスト可能にする。記事ページはサーバコンポーネントで
 * 本番 API から取得した実データ（法案一覧・ランキング・政党集計）をここに渡して集計する。
 * ハードコードした決め打ちの数値は持たない（本番データの陳腐化・捏造を避ける）。
 */

import type { BillListItem, PartySummary } from './api-client';
import { BILL_STATUS_ORDER } from './bills';
import type { Politician } from './types';

/** 合計に対する百分率（小数第1位）。total<=0 のときは 0 を返す。 */
export function percentage(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

// --- 記事1: 立法活動 ---

export type StatusCount = { status: string; count: number; percentage: number };

/**
 * 法案のステータス分布。BILL_STATUS_ORDER（成立→審議中→提出→撤回）の順で、
 * 実データに存在するステータスのみを返す。未知のステータスは末尾に件数順で足す。
 */
export function billStatusDistribution(bills: BillListItem[]): StatusCount[] {
  const counts = new Map<string, number>();
  for (const b of bills) counts.set(b.status, (counts.get(b.status) ?? 0) + 1);

  const total = bills.length;
  const known = BILL_STATUS_ORDER.filter((s) => counts.has(s));
  const unknown = [...counts.keys()]
    .filter((s) => !BILL_STATUS_ORDER.includes(s as (typeof BILL_STATUS_ORDER)[number]))
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));

  return [...known, ...unknown].map((status) => {
    const count = counts.get(status) ?? 0;
    return { status, count, percentage: percentage(count, total) };
  });
}

export type SponsorTypeBreakdown = {
  /** 提出者データが登録されていない法案（閣法・予算・委員会提出など）。sponsor_count === 0。 */
  cabinetOrCommittee: number;
  /** 提出者が登録された法案（議員立法）。sponsor_count >= 1。 */
  memberInitiated: number;
  /** 議員立法のうち提出者が1名のもの。 */
  memberInitiatedSolo: number;
  /** 議員立法のうち提出者・賛成者が複数のもの。 */
  memberInitiatedMulti: number;
  total: number;
};

/**
 * 提出者数（sponsor_count）による法案の内訳。
 * sponsor_count === 0 は提出者が登録されない法案（閣法・予算・委員会提出など）。
 * これを「議員立法かどうか」の近似として扱う（データの限界。記事本文でも明記する）。
 */
export function sponsorTypeBreakdown(bills: BillListItem[]): SponsorTypeBreakdown {
  let cabinetOrCommittee = 0;
  let solo = 0;
  let multi = 0;
  for (const b of bills) {
    if (b.sponsor_count <= 0) cabinetOrCommittee += 1;
    else if (b.sponsor_count === 1) solo += 1;
    else multi += 1;
  }
  return {
    cabinetOrCommittee,
    memberInitiated: solo + multi,
    memberInitiatedSolo: solo,
    memberInitiatedMulti: multi,
    total: bills.length,
  };
}

/**
 * 述語に一致する法案だけのステータス分布。
 * 「議員立法（sponsor_count>=1）のステータス内訳」などのサブ集計に使う。
 */
export function statusDistributionWhere(
  bills: BillListItem[],
  predicate: (b: BillListItem) => boolean,
): StatusCount[] {
  return billStatusDistribution(bills.filter(predicate));
}

/**
 * 立法実績スコア上位の議員。legislation スコアが 0 より大きい議員のみを対象に、
 * スコア降順（同点は最終スコア降順）で上位 n 名を返す。
 * ※これは「提出件数そのもの」ではなく当サイトが算出した立法実績スコア。
 */
export function topByLegislation(politicians: Politician[], n: number): Politician[] {
  return politicians
    .filter((p) => p.metrics.legislation > 0)
    .sort((a, b) => b.metrics.legislation - a.metrics.legislation || b.score - a.score)
    .slice(0, n);
}

// --- 記事2: 政党別スコア分布 ---

export type PartyDistributionSummary = {
  partyCount: number;
  totalMembers: number;
  representatives: number;
  councillors: number;
  /** 平均スコアの最小・最大（分布の広がりを示すため。優劣の断定には使わない）。 */
  minAvg: number;
  maxAvg: number;
};

/** 政党集計の全体サマリ。分布の広がりを示すためのメタ情報。 */
export function partyDistributionSummary(parties: PartySummary[]): PartyDistributionSummary {
  const avgs = parties.map((p) => p.avg_score);
  return {
    partyCount: parties.length,
    totalMembers: parties.reduce((s, p) => s + p.member_count, 0),
    representatives: parties.reduce((s, p) => s + p.representatives, 0),
    councillors: parties.reduce((s, p) => s + p.councillors, 0),
    minAvg: avgs.length ? Math.min(...avgs) : 0,
    maxAvg: avgs.length ? Math.max(...avgs) : 0,
  };
}

/** 所属議員数の多い順。同数はスコア平均降順で安定化。 */
export function partiesSortedByMembers(parties: PartySummary[]): PartySummary[] {
  return [...parties].sort((a, b) => b.member_count - a.member_count || b.avg_score - a.avg_score);
}

/** 平均スコアの高い順。分布として提示するためで、優劣の断定には用いない。 */
export function partiesSortedByAvg(parties: PartySummary[]): PartySummary[] {
  return [...parties].sort((a, b) => b.avg_score - a.avg_score || b.member_count - a.member_count);
}
