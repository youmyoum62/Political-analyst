import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LegislativeActivity } from '@/components/LegislativeActivity';
import type { PoliticianBill } from '@/lib/api-client';
import { checkA11y } from '../fixtures';

function makeBill(overrides: Partial<PoliticianBill> = {}): PoliticianBill {
  return {
    bill_id: 535,
    bill_code: 'hr-衆法-221-8',
    title: '食育基本法の一部を改正する法律案',
    role: 'primary',
    status: 'passed',
    submitted_date: '2026-04-22',
    ...overrides,
  };
}

describe('LegislativeActivity', () => {
  it('法案が空なら何も描画しない', () => {
    const { container } = render(<LegislativeActivity bills={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('法案名・役割・ステータス・提出日を表示する', () => {
    render(<LegislativeActivity bills={[makeBill()]} />);
    expect(screen.getByRole('heading', { name: '立法活動' })).toBeInTheDocument();
    expect(screen.getByText('提出者')).toBeInTheDocument();
    expect(screen.getByText('成立')).toBeInTheDocument();
    expect(screen.getByText('2026年4月22日')).toBeInTheDocument();
  });

  it('法案名は bill_code をエンコードした法案ページへの内部リンクにする', () => {
    render(<LegislativeActivity bills={[makeBill()]} />);
    const link = screen.getByRole('link', { name: '食育基本法の一部を改正する法律案' });
    expect(link).toHaveAttribute('href', `/bills/${encodeURIComponent('hr-衆法-221-8')}`);
  });

  it('共同提出（co）の役割ラベルを表示する', () => {
    render(<LegislativeActivity bills={[makeBill({ role: 'co', status: 'in_committee' })]} />);
    expect(screen.getByText('賛成者・共同提出者')).toBeInTheDocument();
    expect(screen.getByText('審議中')).toBeInTheDocument();
  });

  it('提出日が null でも壊れない', () => {
    render(<LegislativeActivity bills={[makeBill({ submitted_date: null })]} />);
    expect(screen.getByRole('link', { name: /食育基本法/ })).toBeInTheDocument();
  });

  it('a11y 違反がない', async () => {
    const { container } = render(
      <LegislativeActivity
        bills={[makeBill(), makeBill({ bill_id: 2, bill_code: 'hr-衆法-221-9', role: 'co' })]}
      />,
    );
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
