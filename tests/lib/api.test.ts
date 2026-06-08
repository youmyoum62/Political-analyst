import { describe, it, expect } from 'vitest';
import {
  filterPoliticians,
  getParties,
  getRankedPoliticians,
  getRisingPoliticians,
  getBiggestDrops,
  type FilterOptions,
} from '@/lib/api';
import { makePolitician } from '../fixtures';

const ALL_PASS: FilterOptions = {
  ageGroup: 'All',
  party: 'All',
  gender: 'All',
  house: 'All',
  query: '',
  showInactive: true,
};

describe('filterPoliticians', () => {
  it('showInactive=false のとき発言ゼロ議員を除外する', () => {
    const data = [
      makePolitician({ id: 1, isInactive: false }),
      makePolitician({ id: 2, isInactive: true }),
    ];
    const result = filterPoliticians(data, { ...ALL_PASS, showInactive: false });
    expect(result.map((p) => p.id)).toEqual([1]);
  });

  it('showInactive=true のとき発言ゼロ議員も含む', () => {
    const data = [
      makePolitician({ id: 1, isInactive: false }),
      makePolitician({ id: 2, isInactive: true }),
    ];
    const result = filterPoliticians(data, { ...ALL_PASS, showInactive: true });
    expect(result.map((p) => p.id)).toEqual([1, 2]);
  });

  it('年代フィルターを境界値込みで適用する', () => {
    const data = [
      makePolitician({ id: 1, age: 39 }),
      makePolitician({ id: 2, age: 40 }),
      makePolitician({ id: 3, age: 59 }),
      makePolitician({ id: 4, age: 60 }),
    ];
    expect(
      filterPoliticians(data, { ...ALL_PASS, ageGroup: '20s-30s' }).map((p) => p.id),
    ).toEqual([1]);
    expect(
      filterPoliticians(data, { ...ALL_PASS, ageGroup: '40s-50s' }).map((p) => p.id),
    ).toEqual([2, 3]);
    expect(
      filterPoliticians(data, { ...ALL_PASS, ageGroup: '60+' }).map((p) => p.id),
    ).toEqual([4]);
  });

  it('年齢 null は年代指定時に除外し、All のとき含む', () => {
    const data = [makePolitician({ id: 1, age: null }), makePolitician({ id: 2, age: 45 })];
    expect(
      filterPoliticians(data, { ...ALL_PASS, ageGroup: '40s-50s' }).map((p) => p.id),
    ).toEqual([2]);
    expect(
      filterPoliticians(data, { ...ALL_PASS, ageGroup: 'All' }).map((p) => p.id),
    ).toEqual([1, 2]);
  });

  it('党派・性別・院で絞り込む', () => {
    const data = [
      makePolitician({ id: 1, party: '自民党', gender: 'Male', house: 'representatives' }),
      makePolitician({ id: 2, party: '立憲', gender: 'Female', house: 'councillors' }),
    ];
    expect(filterPoliticians(data, { ...ALL_PASS, party: '立憲' }).map((p) => p.id)).toEqual([2]);
    expect(filterPoliticians(data, { ...ALL_PASS, gender: 'Male' }).map((p) => p.id)).toEqual([1]);
    expect(
      filterPoliticians(data, { ...ALL_PASS, house: 'councillors' }).map((p) => p.id),
    ).toEqual([2]);
  });

  it('検索クエリは名前・党派・選挙区を大文字小文字を無視して部分一致する', () => {
    const data = [
      makePolitician({ id: 1, name: '佐藤花子', party: 'CDP', district: '大阪3区' }),
      makePolitician({ id: 2, name: '田中一郎', party: 'LDP', district: '東京1区' }),
    ];
    expect(filterPoliticians(data, { ...ALL_PASS, query: '佐藤' }).map((p) => p.id)).toEqual([1]);
    expect(filterPoliticians(data, { ...ALL_PASS, query: 'cdp' }).map((p) => p.id)).toEqual([1]);
    expect(filterPoliticians(data, { ...ALL_PASS, query: '東京' }).map((p) => p.id)).toEqual([2]);
    expect(filterPoliticians(data, { ...ALL_PASS, query: '' }).map((p) => p.id)).toEqual([1, 2]);
  });

  it('複合条件（院 AND 党派）を AND で適用する', () => {
    const data = [
      makePolitician({ id: 1, party: '自民党', house: 'representatives' }),
      makePolitician({ id: 2, party: '自民党', house: 'councillors' }),
      makePolitician({ id: 3, party: '立憲', house: 'representatives' }),
    ];
    const result = filterPoliticians(data, {
      ...ALL_PASS,
      party: '自民党',
      house: 'representatives',
    });
    expect(result.map((p) => p.id)).toEqual([1]);
  });
});

describe('getParties', () => {
  it('先頭に All を置き、重複を除いた党派一覧を返す', () => {
    const data = [
      makePolitician({ party: '自民党' }),
      makePolitician({ party: '立憲' }),
      makePolitician({ party: '自民党' }),
    ];
    expect(getParties(data)).toEqual(['All', '自民党', '立憲']);
  });

  it('空配列では All のみ返す', () => {
    expect(getParties([])).toEqual(['All']);
  });
});

describe('getRankedPoliticians', () => {
  it('スコア降順に並べる', () => {
    const data = [
      makePolitician({ id: 1, score: 50 }),
      makePolitician({ id: 2, score: 90 }),
      makePolitician({ id: 3, score: 70 }),
    ];
    expect(getRankedPoliticians(data).map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it('元の配列を破壊しない（イミュータブル）', () => {
    const data = [
      makePolitician({ id: 1, score: 50 }),
      makePolitician({ id: 2, score: 90 }),
    ];
    getRankedPoliticians(data);
    expect(data.map((p) => p.id)).toEqual([1, 2]);
  });
});

describe('getRisingPoliticians', () => {
  it('trend>0 のみを上昇幅の降順で返す', () => {
    const data = [
      makePolitician({ id: 1, trend: 5 }),
      makePolitician({ id: 2, trend: -3 }),
      makePolitician({ id: 3, trend: 10 }),
      makePolitician({ id: 4, trend: 0 }),
    ];
    expect(getRisingPoliticians(data).map((p) => p.id)).toEqual([3, 1]);
  });

  it('limit で上位件数だけに絞る', () => {
    const data = [
      makePolitician({ id: 1, trend: 5 }),
      makePolitician({ id: 3, trend: 10 }),
      makePolitician({ id: 5, trend: 2 }),
    ];
    // 降順 [10, 5, 2] のうち上位2件。trend=2 の id:5 が確実に落ちることを検証。
    expect(getRisingPoliticians(data, 2).map((p) => p.id)).toEqual([3, 1]);
  });
});

describe('getBiggestDrops', () => {
  it('trend<0 のみを下降幅の大きい順で返す', () => {
    const data = [
      makePolitician({ id: 1, trend: -3 }),
      makePolitician({ id: 2, trend: 4 }),
      makePolitician({ id: 3, trend: -10 }),
    ];
    expect(getBiggestDrops(data).map((p) => p.id)).toEqual([3, 1]);
  });

  it('limit で下降幅の上位件数だけに絞る', () => {
    const data = [
      makePolitician({ id: 1, trend: -3 }),
      makePolitician({ id: 3, trend: -10 }),
      makePolitician({ id: 5, trend: -1 }),
    ];
    // 下降幅 [-10, -3, -1] のうち上位2件。trend=-1 の id:5 が落ちる。
    expect(getBiggestDrops(data, 2).map((p) => p.id)).toEqual([3, 1]);
  });
});
