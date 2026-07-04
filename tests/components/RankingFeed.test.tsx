import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/** 段階表示テスト用に、党派だけ変えたN件のリストを作る。 */
function makeManyList(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makePolitician({
      id: i + 1,
      name: `議員${String(i + 1).padStart(3, '0')}`,
      score: count - i,
      rank: i + 1,
      party: i === 0 ? '無所属' : '自民党',
    })
  );
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

  it('initialPrefecture で都道府県フィルタが初期適用される', () => {
    const list = [
      makePolitician({ id: 1, name: '東京太郎', district: '東京1', score: 90, rank: 1 }),
      makePolitician({ id: 2, name: '大阪次郎', district: '大阪3', score: 80, rank: 2 }),
    ];
    render(<RankingFeed ranking={list} initialPrefecture="東京" />);
    expect(screen.getByRole('link', { name: /東京太郎/ })).toBeInTheDocument();
    expect(screen.queryByText('大阪次郎')).toBeNull();
  });

  describe('段階表示（limit 未指定・全件ページ）', () => {
    it('61件以上のデータでは最初の60件のみ描画され「さらに表示」ボタンが出る', () => {
      render(<RankingFeed ranking={makeManyList(65)} />);
      // 議員001はヒーロー行にも名前が出るため getAllByText で確認する。
      expect(screen.getAllByText('議員001').length).toBeGreaterThan(0);
      expect(screen.getByText('議員060')).toBeInTheDocument();
      expect(screen.queryByText('議員061')).toBeNull();
      expect(screen.queryByText('議員065')).toBeNull();

      const moreButton = screen.getByRole('button', { name: /さらに表示（残り5名）/ });
      expect(moreButton).toBeInTheDocument();
    });

    it('「さらに表示」ボタン押下で追加表示され、全件表示済みならボタンが消える', async () => {
      const user = userEvent.setup();
      render(<RankingFeed ranking={makeManyList(65)} />);

      await user.click(screen.getByRole('button', { name: /さらに表示/ }));

      expect(screen.getByText('議員061')).toBeInTheDocument();
      expect(screen.getByText('議員065')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /さらに表示/ })).toBeNull();
    });

    it('60件以下のデータでは「さらに表示」ボタンを出さない', () => {
      render(<RankingFeed ranking={makeManyList(60)} />);
      expect(screen.getByText('議員060')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /さらに表示/ })).toBeNull();
    });

    it('フィルタ変更で表示件数が60にリセットされる', async () => {
      const user = userEvent.setup();
      render(<RankingFeed ranking={makeManyList(65)} />);

      // まず追加表示して61件目以降を出しておく。
      await user.click(screen.getByRole('button', { name: /さらに表示/ }));
      expect(screen.getByText('議員065')).toBeInTheDocument();

      // フィルタ（党派）を変更するとフィルタ結果は「無所属」の議員001のみ1件になる。
      // 議員001はヒーロー行にも名前が出るため getAllByText で確認する。
      await user.selectOptions(screen.getByLabelText('党派で絞り込む'), '無所属');
      expect(screen.getAllByText('議員001').length).toBeGreaterThan(0);
      expect(screen.queryByText('議員065')).toBeNull();

      // 党派フィルタを解除して全件（65件）に戻すと、リセットされた60件のみ表示され、
      // 65件目はまだ見えない（＝以前の追加表示状態が持ち越されていない）ことを確認する。
      await user.selectOptions(screen.getByLabelText('党派で絞り込む'), '政党 ▾');
      expect(screen.getByText('議員060')).toBeInTheDocument();
      expect(screen.queryByText('議員065')).toBeNull();
      expect(screen.getByRole('button', { name: /さらに表示（残り5名）/ })).toBeInTheDocument();
    });
  });

  describe('段階表示（limit 指定時は従来どおり）', () => {
    it('limit 指定時は「さらに表示」ボタンを出さず、従来の全件リンクのみ出す', () => {
      render(<RankingFeed ranking={makeManyList(65)} limit={2} />);
      expect(screen.queryByRole('button', { name: /さらに表示/ })).toBeNull();
      expect(screen.getByRole('link', { name: /名のランキングを見る/ })).toBeInTheDocument();
    });
  });
});
