import { describe, it, expect } from 'vitest';
import { escapeXml, toRfc822, digestToFeedItems, buildRssXml } from '@/lib/feed';
import type { Digest } from '@/lib/api-client';

describe('escapeXml', () => {
  it('& < > " \' をすべてエスケープする', () => {
    expect(escapeXml(`Tom & Jerry <"quote's">`)).toBe(
      'Tom &amp; Jerry &lt;&quot;quote&apos;s&quot;&gt;',
    );
  });

  it('特殊文字を含まない文字列はそのまま返す', () => {
    expect(escapeXml('通常のテキスト')).toBe('通常のテキスト');
  });
});

describe('toRfc822', () => {
  it('YYYY-MM-DD を RFC822 形式へ変換する', () => {
    const result = toRfc822('2026-07-03');
    // toUTCString は "Fri, 03 Jul 2026 00:00:00 GMT" のような形式
    expect(result).toMatch(/^\w{3}, \d{2} Jul 2026 \d{2}:\d{2}:\d{2} GMT$/);
  });

  it('不正な日付文字列は現在時刻へフォールバックする（例外を投げない）', () => {
    expect(() => toRfc822('not-a-date')).not.toThrow();
    expect(typeof toRfc822('not-a-date')).toBe('string');
  });
});

const SITE_URL = 'https://example.test';

function makeDigest(overrides: Partial<Digest> = {}): Digest {
  return {
    generated_at: '2026-07-03T00:00:00Z',
    latest_activity_date: '2026-07-03',
    in_session: true,
    minutes: [
      {
        date: '2026-07-03',
        speaker_count: 2,
        speakers: [
          {
            politician_id: 1,
            name: '山田太郎',
            party: '自民党',
            activity_type: 'question',
            source_url: 'https://kokkai.ndl.go.jp/example1',
          },
          {
            politician_id: 2,
            name: '鈴木花子',
            party: null,
            activity_type: 'speech',
            source_url: 'https://kokkai.ndl.go.jp/example2',
          },
        ],
      },
    ],
    bills: [
      {
        id: 10,
        title: 'サンプル法案',
        status: 'passed',
        date: '2026-07-02',
        source_url: 'https://example.com/bill/10',
      },
      {
        id: 11,
        title: '出典なし法案',
        status: 'unknown_status',
        date: null,
        source_url: null,
      },
    ],
    ...overrides,
  };
}

describe('digestToFeedItems', () => {
  it('minutes を日単位で 1 item に集約し、代表 link は先頭発言者の source_url を使う', () => {
    const items = digestToFeedItems(makeDigest(), SITE_URL);
    const minutesItem = items.find((i) => i.guid.includes('minutes-'));
    expect(minutesItem).toBeDefined();
    expect(minutesItem?.title).toBe('新着会議録: 2026-07-03（2件）');
    expect(minutesItem?.link).toBe('https://kokkai.ndl.go.jp/example1');
    expect(minutesItem?.description).toContain('山田太郎（自民党） - 質問');
    expect(minutesItem?.description).toContain('鈴木花子 - 発言');
  });

  it('bills は 1 件 1 item、source_url が無ければ siteUrl にフォールバックする', () => {
    const items = digestToFeedItems(makeDigest(), SITE_URL);
    const billWithUrl = items.find((i) => i.guid.includes('bill-10'));
    const billWithoutUrl = items.find((i) => i.guid.includes('bill-11'));
    expect(billWithUrl?.title).toBe('法案の動き: サンプル法案（成立・可決）');
    expect(billWithUrl?.link).toBe('https://example.com/bill/10');
    expect(billWithoutUrl?.link).toBe(SITE_URL);
    // 未知の status はラベル変換せずそのまま表示する
    expect(billWithoutUrl?.title).toBe('法案の動き: 出典なし法案（unknown_status）');
  });

  it('minutes・bills が空なら空配列を返す', () => {
    const items = digestToFeedItems(makeDigest({ minutes: [], bills: [] }), SITE_URL);
    expect(items).toEqual([]);
  });
});

describe('buildRssXml', () => {
  it('チャンネル情報と item を含む妥当な RSS 2.0 XML を生成する', () => {
    const items = digestToFeedItems(makeDigest(), SITE_URL);
    const xml = buildRssXml({
      title: 'テストサイト — 国会の動き',
      link: SITE_URL,
      description: 'テスト用の説明',
      siteUrl: SITE_URL,
      items,
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<title>テストサイト — 国会の動き</title>');
    expect(xml).toContain('<language>ja</language>');
    expect(xml).toContain(`<atom:link href="${SITE_URL}/feed.xml"`);
    expect(xml).toContain('<item>');
    // item 数が items.length と一致する
    expect(xml.split('<item>').length - 1).toBe(items.length);
  });

  it('タイトル等に含まれる特殊文字をエスケープする', () => {
    const xml = buildRssXml({
      title: 'A & B',
      link: SITE_URL,
      description: '<desc>',
      siteUrl: SITE_URL,
      items: [],
    });
    expect(xml).toContain('<title>A &amp; B</title>');
    expect(xml).toContain('<description>&lt;desc&gt;</description>');
  });

  it('items が空でも妥当な channel を返す（API 障害時のフォールバック相当）', () => {
    const xml = buildRssXml({
      title: '空チャンネル',
      link: SITE_URL,
      description: '説明',
      siteUrl: SITE_URL,
      items: [],
    });
    expect(xml).toContain('<channel>');
    expect(xml).not.toContain('<item>');
  });
});
