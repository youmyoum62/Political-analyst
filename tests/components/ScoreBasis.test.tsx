import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ScoreBasis } from '@/components/ScoreBasis';
import type { PoliticianBill, PoliticianRole } from '@/lib/api-client';
import type { ScoreBasisInput } from '@/lib/score-basis';
import { checkA11y } from '../fixtures';

const baseScores: Omit<ScoreBasisInput, 'bills' | 'roles' | 'top_speeches'> = {
  participation_score: 30,
  quality_score: 50,
  legislative_score: 60,
  policy_impact_score: 40,
  influence_score: 25,
};

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
  role_name: '委員長',
  start_date: '2026-01-01',
  end_date: null,
  ...o,
});

describe('ScoreBasis', () => {
  it('裏付けデータが1軸も無ければ何も描画しない', () => {
    const { container } = render(<ScoreBasis input={{ ...baseScores }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('立法データがあれば見出しと実カウントを表示する', () => {
    render(
      <ScoreBasis
        input={{
          ...baseScores,
          bills: [bill({ role: 'primary' }), bill({ bill_id: 2, role: 'co', status: 'in_committee' })],
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'スコアの根拠' })).toBeInTheDocument();
    expect(screen.getByText('主提出 1件')).toBeInTheDocument();
    expect(screen.getByText('共同提出 1件')).toBeInTheDocument();
  });

  it('影響力: 役職の実カウントを表示する', () => {
    render(<ScoreBasis input={{ ...baseScores, roles: [role({ role_name: '委員長' })] }} />);
    expect(screen.getByText('委員長 1件')).toBeInTheDocument();
  });

  it('裏付けのない軸は「準備中」として正直に列挙する', () => {
    render(<ScoreBasis input={{ ...baseScores, roles: [role()] }} />);
    // roles のみ裏付けありなので、議会参加・発言品質・立法実績・政策実現が準備中に含まれる
    expect(screen.getByText(/準備中/)).toBeInTheDocument();
    expect(screen.getByText(/議会参加/)).toBeInTheDocument();
  });

  it('a11y 違反がない', async () => {
    const { container } = render(
      <ScoreBasis
        input={{
          ...baseScores,
          bills: [bill()],
          roles: [role()],
        }}
      />,
    );
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
