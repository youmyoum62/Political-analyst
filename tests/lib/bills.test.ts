import { describe, it, expect } from 'vitest';

import {
  billStatusLabel,
  billStatusTone,
  billRoleLabel,
  formatBillDate,
  BILL_STATUS_ORDER,
} from '@/lib/bills';

describe('bills ヘルパー', () => {
  it('実データの status を日本語ラベルに変換する', () => {
    expect(billStatusLabel('passed')).toBe('成立');
    expect(billStatusLabel('in_committee')).toBe('審議中');
    expect(billStatusLabel('submitted')).toBe('提出');
    expect(billStatusLabel('withdrawn')).toBe('撤回');
  });

  it('未知の status はそのまま返す', () => {
    expect(billStatusLabel('unknown_x')).toBe('unknown_x');
  });

  it('status ごとにトーン用クラスを返し、未知値でも中立トーンにフォールバックする', () => {
    expect(billStatusTone('passed')).toContain('text-up');
    expect(billStatusTone('unknown_x')).toContain('text-muted');
  });

  it('sponsors の role を日本語ラベルに変換する', () => {
    expect(billRoleLabel('primary')).toBe('提出者');
    expect(billRoleLabel('co')).toBe('賛成者・共同提出者');
    expect(billRoleLabel('other_x')).toBe('other_x');
  });

  it('ISO 日付を和式に整形し、null は — にする', () => {
    expect(formatBillDate('2026-06-03')).toBe('2026年6月3日');
    expect(formatBillDate('2026-06-03T00:00:00')).toBe('2026年6月3日');
    expect(formatBillDate(null)).toBe('—');
  });

  it('フィルタタブ順は 4 つの実 status を件数分布順に持つ', () => {
    expect([...BILL_STATUS_ORDER]).toEqual(['passed', 'in_committee', 'submitted', 'withdrawn']);
  });
});
