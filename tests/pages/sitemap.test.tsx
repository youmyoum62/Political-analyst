import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  fetchRankingSafe: vi.fn(),
  API_BASE: 'https://api.test',
}));

import { fetchRankingSafe } from '@/lib/api-client';
import { SITE_URL } from '@/lib/site';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

const mockedFetch = vi.mocked(fetchRankingSafe);

/** sitemap の法案取得（global fetch）をスタブする。 */
function stubBillsFetch(codes: string[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: codes.map((code, i) => ({ id: i + 1, bill_code: code })),
        total: codes.length,
      }),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sitemap', () => {
  it('固定ページ・議員ページ・法案ページのURLを含む', async () => {
    mockedFetch.mockResolvedValue([{ id: 7 }, { id: 9 }] as never);
    stubBillsFetch(['hr-衆法-221-9']);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(SITE_URL);
    expect(urls.some((u) => u.endsWith('/ranking'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/bills'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/methodology'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/politicians/7'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/politicians/9'))).toBe(true);
    expect(urls.some((u) => u.includes(`/bills/${encodeURIComponent('hr-衆法-221-9')}`))).toBe(true);
  });

  it('API 不達（空配列）でも固定ページは出力する', async () => {
    mockedFetch.mockResolvedValue([] as never);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => u.endsWith('/about'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/bills'))).toBe(true);
    expect(urls.some((u) => u.includes('/politicians/'))).toBe(false);
    expect(urls.some((u) => /\/bills\/.+/.test(u))).toBe(false);
  });
});

describe('robots', () => {
  it('sitemap.xml を参照し全体を許可する', () => {
    const r = robots();
    expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
    expect(r.rules).toMatchObject({ userAgent: '*', allow: '/' });
  });
});
