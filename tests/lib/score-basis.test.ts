import { describe, it, expect } from 'vitest';

import type { PoliticianBill, PoliticianRole, TopSpeech } from '@/lib/api-client';
import {
  buildScoreBasis,
  hasAnyEvidence,
  tallyBills,
  tallyRoles,
  tallySpeeches,
  type ScoreBasisInput,
} from '@/lib/score-basis';

const bill = (o: Partial<PoliticianBill> = {}): PoliticianBill => ({
  bill_id: 1,
  bill_code: 'hr-衆法-221-1',
  title: '法案',
  role: 'primary',
  status: 'passed',
  submitted_date: '2026-05-01',
  ...o,
});

const role = (o: Partial<PoliticianRole> = {}): PoliticianRole => ({
  role_scope: 'committee',
  role_name: '委員',
  start_date: '2026-01-01',
  end_date: null,
  ...o,
});

const speech = (o: Partial<TopSpeech> = {}): TopSpeech => ({
  activity_id: 1,
  activity_type: 'question',
  session_date: '2026-04-01',
  excerpt: '発言抜粋',
  score: 80,
  confidence: 0.9,
  rationale: '論評',
  source_url: 'https://example.com/1',
  ...o,
});

const baseScores: Omit<ScoreBasisInput, 'bills' | 'roles' | 'top_speeches'> = {
  participation_score: 30,
  quality_score: 50,
  legislative_score: 60,
  policy_impact_score: 40,
  influence_score: 25,
};

describe('tallyBills', () => {
  it('役割・ステータス別に集計する', () => {
    const t = tallyBills([
      bill({ role: 'primary', status: 'passed' }),
      bill({ role: 'co', status: 'passed' }),
      bill({ role: 'co', status: 'in_committee' }),
      bill({ role: 'committee', status: 'submitted' }),
      bill({ role: 'unknown', status: 'withdrawn' }),
    ]);
    expect(t.total).toBe(5);
    expect(t.primary).toBe(1);
    expect(t.co).toBe(2);
    expect(t.committee).toBe(1);
    expect(t.otherRole).toBe(1);
    expect(t.passed).toBe(2);
    expect(t.inCommittee).toBe(1);
    expect(t.submitted).toBe(1);
    expect(t.withdrawn).toBe(1);
  });

  it('null/undefined/空でゼロ集計を返す', () => {
    for (const input of [null, undefined, []]) {
      const t = tallyBills(input as PoliticianBill[] | null | undefined);
      expect(t.total).toBe(0);
      expect(t.primary).toBe(0);
    }
  });
});

describe('tallyRoles', () => {
  it('役職名ごとに件数を集計し、件数降順・同数は名称昇順で並べる', () => {
    const t = tallyRoles([
      role({ role_name: '委員' }),
      role({ role_name: '委員' }),
      role({ role_name: '理事' }),
      role({ role_name: '委員長' }),
    ]);
    expect(t.total).toBe(4);
    expect(t.byName[0]).toEqual({ name: '委員', count: 2 });
    // 理事・委員長は同数(1)なので名称昇順
    expect(t.byName.slice(1)).toEqual([
      { name: '委員長', count: 1 },
      { name: '理事', count: 1 },
    ]);
  });

  it('要職（委員長・理事・幹事長等）を leadership として数える', () => {
    const t = tallyRoles([
      role({ role_name: '委員長' }),
      role({ role_name: '副委員長' }),
      role({ role_name: '理事' }),
      role({ role_name: '幹事長' }),
      role({ role_name: '委員' }), // 平の委員は要職ではない
    ]);
    expect(t.leadership).toBe(4);
  });

  it('null/空で空集計を返す', () => {
    expect(tallyRoles(null)).toEqual({ total: 0, byName: [], leadership: 0 });
    expect(tallyRoles([])).toEqual({ total: 0, byName: [], leadership: 0 });
  });
});

describe('tallySpeeches', () => {
  it('件数とAI評価スコア平均（小数第1位）を返す', () => {
    const t = tallySpeeches([speech({ score: 80 }), speech({ score: 70 }), speech({ score: 75 })]);
    expect(t.count).toBe(3);
    expect(t.avgScore).toBe(75);
  });

  it('score が null の発言は平均から除外する', () => {
    const t = tallySpeeches([speech({ score: 90 }), speech({ score: null })]);
    expect(t.count).toBe(2);
    expect(t.avgScore).toBe(90);
  });

  it('全て score null なら avgScore は null', () => {
    const t = tallySpeeches([speech({ score: null })]);
    expect(t.avgScore).toBeNull();
  });

  it('空で count 0・avgScore null', () => {
    expect(tallySpeeches([])).toEqual({ count: 0, avgScore: null });
    expect(tallySpeeches(null)).toEqual({ count: 0, avgScore: null });
  });
});

describe('buildScoreBasis', () => {
  it('立法実績: bills があれば主提出/共同/計を根拠として持つ', () => {
    const basis = buildScoreBasis({
      ...baseScores,
      bills: [
        bill({ role: 'primary', status: 'passed' }),
        bill({ role: 'co', status: 'in_committee' }),
        bill({ role: 'co', status: 'passed' }),
      ],
    });
    const leg = basis.find((b) => b.key === 'legislative')!;
    expect(leg.hasEvidence).toBe(true);
    expect(leg.facts).toContain('主提出 1件');
    expect(leg.facts).toContain('共同提出 2件');
    expect(leg.facts).toContain('関与した法案 計3件');
  });

  it('政策実現: bills の成立/審議中を根拠として持つ', () => {
    const basis = buildScoreBasis({
      ...baseScores,
      bills: [
        bill({ status: 'passed' }),
        bill({ status: 'passed' }),
        bill({ status: 'in_committee' }),
      ],
    });
    const pol = basis.find((b) => b.key === 'policy_impact')!;
    expect(pol.hasEvidence).toBe(true);
    expect(pol.facts).toContain('成立 2件');
    expect(pol.facts).toContain('審議中 1件');
  });

  it('影響力: roles があれば役職名×件数を根拠として持つ', () => {
    const basis = buildScoreBasis({
      ...baseScores,
      roles: [role({ role_name: '委員長' }), role({ role_name: '理事' }), role({ role_name: '理事' })],
    });
    const inf = basis.find((b) => b.key === 'influence')!;
    expect(inf.hasEvidence).toBe(true);
    expect(inf.facts).toContain('理事 2件');
    expect(inf.facts).toContain('委員長 1件');
  });

  it('発言品質: top_speeches があれば件数と平均を根拠として持つ', () => {
    const basis = buildScoreBasis({
      ...baseScores,
      top_speeches: [speech({ score: 80 }), speech({ score: 60 })],
    });
    const q = basis.find((b) => b.key === 'quality')!;
    expect(q.hasEvidence).toBe(true);
    expect(q.facts.some((f) => f.includes('2件'))).toBe(true);
    expect(q.facts.some((f) => f.includes('70'))).toBe(true);
  });

  it('議会参加は常に裏付けなし（実カウント非公開）で正直な注記を持つ', () => {
    const basis = buildScoreBasis({ ...baseScores });
    const part = basis.find((b) => b.key === 'participation')!;
    expect(part.hasEvidence).toBe(false);
    expect(part.facts).toEqual([]);
    expect(part.note).toBeTruthy();
  });

  it('データ皆無なら全軸 hasEvidence=false かつ注記つき', () => {
    const basis = buildScoreBasis({ ...baseScores });
    expect(basis).toHaveLength(5);
    expect(basis.every((b) => !b.hasEvidence)).toBe(true);
    expect(basis.every((b) => b.note)).toBe(true);
    expect(hasAnyEvidence(basis)).toBe(false);
  });

  it('捏造しない: bills/roles/speeches が空なら該当軸の facts は空', () => {
    const basis = buildScoreBasis({ ...baseScores, bills: [], roles: [], top_speeches: [] });
    for (const b of basis) expect(b.facts).toEqual([]);
  });

  it('hasAnyEvidence は裏付け軸が1つでもあれば true', () => {
    const basis = buildScoreBasis({ ...baseScores, roles: [role()] });
    expect(hasAnyEvidence(basis)).toBe(true);
  });
});
