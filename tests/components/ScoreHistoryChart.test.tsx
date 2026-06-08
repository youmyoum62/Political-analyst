import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreHistoryChart } from '@/components/ScoreHistoryChart';
import { makeHistoryPoint } from '../fixtures';

describe('ScoreHistoryChart', () => {
  it('2期未満ではフォールバックメッセージを表示する', () => {
    render(<ScoreHistoryChart history={[makeHistoryPoint()]} />);
    expect(screen.getByText('スコア推移はデータ蓄積中です')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('履歴ゼロでもフォールバックを表示する', () => {
    render(<ScoreHistoryChart history={[]} />);
    expect(screen.getByText('スコア推移はデータ蓄積中です')).toBeInTheDocument();
  });

  it('2期以上では role=img と説明的な aria-label を付与する', () => {
    render(
      <ScoreHistoryChart
        history={[
          makeHistoryPoint({ period_start: '2025-01-01', final_score: 40 }),
          makeHistoryPoint({ period_start: '2025-04-01', final_score: 60 }),
        ]}
      />,
    );
    const chart = screen.getByRole('img');
    expect(chart).toHaveAccessibleName(/総合スコアの推移/);
    expect(chart).toHaveAccessibleName(/40点/);
    expect(chart).toHaveAccessibleName(/60点/);
  });
});
