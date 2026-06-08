import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreWeightsCard } from '@/components/ScoreWeightsCard';
import { makeAnalysis, checkA11y } from '../fixtures';

describe('ScoreWeightsCard', () => {
  it('5軸のラベルと最終スコアを表示する', () => {
    render(<ScoreWeightsCard analysis={makeAnalysis({ final_score: 72.5 })} />);
    expect(screen.getByText(/議会参加/)).toBeInTheDocument();
    expect(screen.getByText(/発言品質/)).toBeInTheDocument();
    expect(screen.getByText(/立法実績/)).toBeInTheDocument();
    expect(screen.getByText(/政策実現/)).toBeInTheDocument();
    expect(screen.getByText(/影響力/)).toBeInTheDocument();
    expect(screen.getByText('72.5')).toBeInTheDocument();
  });

  it('各軸に progressbar ロールと aria-value* を付与する', () => {
    render(<ScoreWeightsCard analysis={makeAnalysis({ participation_score: 80 })} />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(5);
    // 先頭は participation（スコア80）
    expect(bars[0]).toHaveAttribute('aria-valuenow', '80');
    expect(bars[0]).toHaveAttribute('aria-valuemin', '0');
    expect(bars[0]).toHaveAttribute('aria-valuemax', '100');
    expect(bars[0]).toHaveAccessibleName('議会参加スコア');
  });

  it('a11y 違反がない', async () => {
    const { container } = render(<ScoreWeightsCard analysis={makeAnalysis()} />);
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
