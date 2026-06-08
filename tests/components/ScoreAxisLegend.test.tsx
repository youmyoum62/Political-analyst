import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreAxisLegend } from '@/components/ScoreAxisLegend';
import { checkA11y } from '../fixtures';

describe('ScoreAxisLegend', () => {
  it('サマリーと5つの評価軸を表示する', () => {
    render(<ScoreAxisLegend />);
    expect(screen.getByText('評価軸の説明')).toBeInTheDocument();
    expect(screen.getByText('議会参加')).toBeInTheDocument();
    expect(screen.getByText('発言品質')).toBeInTheDocument();
    expect(screen.getByText('立法実績')).toBeInTheDocument();
    expect(screen.getByText('政策実現')).toBeInTheDocument();
    expect(screen.getByText('影響力')).toBeInTheDocument();
  });

  it('a11y 違反がない', async () => {
    const { container } = render(<ScoreAxisLegend />);
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
