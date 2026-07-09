import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CareerRoles } from '@/components/CareerRoles';
import type { PoliticianRole } from '@/lib/api-client';
import { checkA11y } from '../fixtures';

function makeRole(overrides: Partial<PoliticianRole> = {}): PoliticianRole {
  return {
    role_scope: 'committee',
    role_name: '委員長',
    start_date: '2026-05-20',
    end_date: null,
    ...overrides,
  };
}

describe('CareerRoles', () => {
  it('役職が空なら何も描画しない', () => {
    const { container } = render(<CareerRoles roles={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('役職名・区分・期間を表示する', () => {
    render(<CareerRoles roles={[makeRole()]} />);
    expect(screen.getByRole('heading', { name: '役職・キャリア' })).toBeInTheDocument();
    expect(screen.getByText('委員長')).toBeInTheDocument();
    expect(screen.getByText('委員会')).toBeInTheDocument();
    expect(screen.getByText('2026年5月〜現任')).toBeInTheDocument();
  });

  it('end_date が null の役職は「現任」と表示する', () => {
    render(<CareerRoles roles={[makeRole({ end_date: null })]} />);
    expect(screen.getByText('現任')).toBeInTheDocument();
  });

  it('end_date がある役職は「現任」を表示しない', () => {
    render(
      <CareerRoles roles={[makeRole({ start_date: '2024-01-10', end_date: '2025-12-20' })]} />,
    );
    expect(screen.queryByText('現任')).toBeNull();
    expect(screen.getByText('2024年1月〜2025年12月')).toBeInTheDocument();
  });

  it('開始日の新しい順に並べる', () => {
    render(
      <CareerRoles
        roles={[
          makeRole({ role_name: '委員', start_date: '2026-03-10' }),
          makeRole({ role_name: '理事', start_date: '2026-06-02' }),
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('理事');
    expect(items[1]).toHaveTextContent('委員');
  });

  it('a11y 違反がない', async () => {
    const { container } = render(
      <CareerRoles roles={[makeRole(), makeRole({ role_name: '委員', role_scope: 'party' })]} />,
    );
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
