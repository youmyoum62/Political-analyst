import { describe, it, expect } from 'vitest';
import { extractPrefectures, PREFECTURES } from '@/lib/district';

describe('extractPrefectures', () => {
  it('番号付き選挙区から都道府県を抽出する', () => {
    expect(extractPrefectures('東京1')).toEqual(['東京']);
    expect(extractPrefectures('大阪19')).toEqual(['大阪']);
    expect(extractPrefectures('京都6')).toEqual(['京都']);
  });

  it('番号なし選挙区も抽出する', () => {
    expect(extractPrefectures('三重')).toEqual(['三重']);
    expect(extractPrefectures('北海道')).toEqual(['北海道']);
    expect(extractPrefectures('北海道10')).toEqual(['北海道']);
  });

  it('合区は両方の都道府県を返す', () => {
    expect(extractPrefectures('徳島・高知').sort()).toEqual(['徳島', '高知'].sort());
    expect(extractPrefectures('鳥取・島根').sort()).toEqual(['鳥取', '島根'].sort());
  });

  it('比例代表は都道府県に紐づかない（空配列）', () => {
    expect(extractPrefectures('比例')).toEqual([]);
    expect(extractPrefectures('（比）近畿')).toEqual([]);
    expect(extractPrefectures('（比）北海道')).toEqual([]);
  });

  it('空・null・未知は空配列', () => {
    expect(extractPrefectures('')).toEqual([]);
    expect(extractPrefectures(null)).toEqual([]);
    expect(extractPrefectures(undefined)).toEqual([]);
    expect(extractPrefectures('海外')).toEqual([]);
  });

  it('47都道府県を定義している', () => {
    expect(PREFECTURES).toHaveLength(47);
    expect(PREFECTURES[0]).toEqual({ value: '北海道', label: '北海道' });
    expect(PREFECTURES.find((p) => p.value === '東京')?.label).toBe('東京都');
  });
});
