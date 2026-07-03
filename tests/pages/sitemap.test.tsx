import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  fetchRankingSafe: vi.fn(),
}));

import { fetchRankingSafe } from '@/lib/api-client';
import { SITE_URL } from '@/lib/site';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

const mockedFetch = vi.mocked(fetchRankingSafe);

describe('sitemap', () => {
  it('固定ページと議員ページ双方のURLを含む', async () => {
    mockedFetch.mockResolvedValue([{ id: 7 }, { id: 9 }] as never);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(SITE_URL);
    expect(urls.some((u) => u.endsWith('/ranking'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/methodology'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/politicians/7'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/politicians/9'))).toBe(true);
  });

  it('API 不達（空配列）でも固定ページは出力する', async () => {
    mockedFetch.mockResolvedValue([] as never);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => u.endsWith('/about'))).toBe(true);
    expect(urls.some((u) => u.includes('/politicians/'))).toBe(false);
  });
});

describe('robots', () => {
  it('sitemap.xml を参照し全体を許可する', () => {
    const r = robots();
    expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
    expect(r.rules).toMatchObject({ userAgent: '*', allow: '/' });
  });
});
