import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RankingCard } from '@/components/RankingCard';
import { makePolitician, checkA11y } from '../fixtures';

describe('RankingCard', () => {
  it('現職カードに順位・名前・スコアを表示する', () => {
    render(<RankingCard item={makePolitician({ name: '佐藤花子', score: 82.4 })} rank={1} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('佐藤花子')).toBeInTheDocument();
    expect(screen.getByText('82.4')).toBeInTheDocument();
  });

  it('リンク先と aria-label に順位・名前・党派・スコアを含む', () => {
    render(
      <RankingCard
        item={makePolitician({ id: 7, name: '佐藤花子', party: '自民党', score: 82.4 })}
        rank={2}
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/politicians/7');
    expect(link).toHaveAccessibleName(/第2位 佐藤花子（自民党）スコア82.4点/);
  });

  it('発言データなし（inactive）カードを表示する', () => {
    render(<RankingCard item={makePolitician({ isInactive: true, score: 0 })} rank={10} />);
    // inactive カードはスコアを参照せず常に "0.0" を表示する仕様（component 側でハードコード）。
    expect(screen.getByText('0.0')).toBeInTheDocument();
    expect(screen.getByText(/発言データなし/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAccessibleName(/発言データなし/);
  });

  it('showTrend で上昇トレンドを表示する', () => {
    render(<RankingCard item={makePolitician({ trend: 3 })} rank={5} showTrend />);
    expect(screen.getByText(/▲ \+3/)).toBeInTheDocument();
  });

  it('showTrend で下降トレンドを表示する', () => {
    render(<RankingCard item={makePolitician({ trend: -2 })} rank={6} showTrend />);
    expect(screen.getByText(/▼ -2/)).toBeInTheDocument();
  });

  it('a11y 違反がない（現職・発言データなし）', async () => {
    const active = render(<RankingCard item={makePolitician()} rank={1} />);
    expect(await checkA11y(active.container)).toHaveNoViolations();

    const inactive = render(
      <RankingCard item={makePolitician({ isInactive: true, score: 0 })} rank={20} />,
    );
    expect(await checkA11y(inactive.container)).toHaveNoViolations();
  });
});
