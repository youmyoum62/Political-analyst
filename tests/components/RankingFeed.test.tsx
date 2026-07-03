import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RankingFeed } from '@/components/RankingFeed';
import { makePolitician } from '../fixtures';

function makeList() {
  // getRankedPoliticians が score 降順に並べる。rank は API 由来の値をそのまま表示する。
  return [
    makePolitician({ id: 1, name: 'あ一郎', score: 90, rank: 1 }),
    makePolitician({ id: 2, name: 'い二郎', score: 80, rank: 2 }),
    makePolitician({ id: 3, name: 'う三郎', score: 70, rank: 3 }),
    makePolitician({ id: 4, name: 'え四郎', score: 60, rank: 4 }),
  ];
}

describe('RankingFeed', () => {
  it('limit 指定時は上位N件のみ表示し、全件ページへのリンクを出す', () => {
    render(<RankingFeed ranking={makeList()} limit={2} />);
    // 最上位はヒーロー行にも名前が出るためカードの aria-label で確認する。
    expect(screen.getByRole('link', { name: /第1位 あ一郎/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /第2位 い二郎/ })).toBeInTheDocument();
    // 上位2件までなので3件目以降は表示されない。
    expect(screen.queryByText('う三郎')).toBeNull();
    expect(screen.queryByText('え四郎')).toBeNull();

    const seeAll = screen.getByRole('link', { name: /名のランキングを見る/ });
    expect(seeAll).toHaveAttribute('href', '/ranking');
  });

  it('limit 指定時はフィルターバーを表示しない（プレビュー表示）', () => {
    render(<RankingFeed ranking={makeList()} limit={2} />);
    expect(screen.queryByLabelText('名前・政党・選挙区で検索')).toBeNull();
  });

  it('limit 未指定時は全件表示し、全件リンクを出さない', () => {
    render(<RankingFeed ranking={makeList()} />);
    expect(screen.getByText('う三郎')).toBeInTheDocument();
    expect(screen.getByText('え四郎')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /名のランキングを見る/ })).toBeNull();
    // 全件表示時はフィルターバーを出す。
    expect(screen.getByLabelText('名前・政党・選挙区で検索')).toBeInTheDocument();
  });

  it('全件件数がlimit以下なら全件リンクを出さない', () => {
    render(<RankingFeed ranking={makeList()} limit={10} />);
    expect(screen.getByText('え四郎')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /名のランキングを見る/ })).toBeNull();
  });
});
