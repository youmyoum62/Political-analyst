import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { size as homeSize, contentType as homeType } from '@/app/opengraph-image';
import { size as polSize, contentType as polType } from '@/app/politicians/[id]/opengraph-image';
import { loadNotoSansJP } from '@/lib/og-font';

describe('OGP画像ルートのメタ', () => {
  it('1200x630 の PNG を宣言する', () => {
    expect(homeSize).toEqual({ width: 1200, height: 630 });
    expect(polSize).toEqual({ width: 1200, height: 630 });
    expect(homeType).toBe('image/png');
    expect(polType).toBe('image/png');
  });
});

describe('loadNotoSansJP', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('css から TTF の URL を抜き出してフォントデータを返す', async () => {
    const buf = new ArrayBuffer(8);
    global.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes('css2')) {
        return new Response(
          "@font-face { src: url(https://fonts.gstatic.com/x.ttf) format('truetype'); }",
          { status: 200 },
        );
      }
      return new Response(buf, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await loadNotoSansJP('山田');
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it('取得失敗時は null を返す（画像側でフォントなしフォールバック）', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    const result = await loadNotoSansJP('山田');
    expect(result).toBeNull();
  });
});
