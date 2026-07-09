import type { MetadataRoute } from 'next';

import { API_BASE, fetchRankingSafe } from '@/lib/api-client';
import { SITE_URL } from '@/lib/site';

// sitemap はリクエスト毎にランタイム生成する（ビルド時 prerender・ISR キャッシュを使わない）。
// ビルド時 or 長期キャッシュだと、Render コールドスタート中に生成された空版が固定され回復
// しない問題があった（home が runtime fetch で 718 を出せているのと同じ経路に揃える）。
// keep-warm cron で Render が常時温かいため、都度 fetch でも高速に全議員分を返す。
export const dynamic = 'force-dynamic';

const STATIC_ROUTES: { path: string; priority: number }[] = [
  { path: '', priority: 1 },
  { path: '/ranking', priority: 0.8 },
  { path: '/bills', priority: 0.7 },
  { path: '/parties', priority: 0.7 },
  { path: '/insights', priority: 0.6 },
  { path: '/insights/legislative-activity', priority: 0.6 },
  { path: '/insights/party-score-distribution', priority: 0.6 },
  { path: '/compare', priority: 0.6 },
  { path: '/about', priority: 0.4 },
  { path: '/methodology', priority: 0.5 },
  { path: '/privacy', priority: 0.3 },
  { path: '/disclaimer', priority: 0.3 },
];

/**
 * 全法案の bill_code を安全に取得する（sitemap 用）。
 * fetchRankingSafe と同じ思想: リトライ無し・タイムアウト付きの単発 fetch で、
 * Render コールドスタートに間に合わなければ空を返してビルド/再生成を止めない
 * （次回 revalidate で回復）。API の limit 上限は 200 のため 3ページまでページングする。
 */
async function fetchBillCodesSafe(timeoutMs = 15_000): Promise<string[]> {
  const PAGE = 200;
  const codes: string[] = [];
  try {
    for (let offset = 0; offset < 1_000; offset += PAGE) {
      const res = await fetch(`${API_BASE}/v1/bills?limit=${PAGE}&offset=${offset}`, {
        signal: AbortSignal.timeout(timeoutMs),
        next: { revalidate: 86400 },
      });
      if (!res.ok) break;
      const data = await res.json();
      const items: { bill_code?: string }[] = Array.isArray(data?.items) ? data.items : [];
      for (const it of items) if (it.bill_code) codes.push(it.bill_code);
      if (offset + PAGE >= (data?.total ?? 0)) break;
    }
  } catch {
    return codes;
  }
  return codes;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [ranking, billCodes] = await Promise.all([fetchRankingSafe(), fetchBillCodesSafe()]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    changeFrequency: 'weekly',
    priority: r.priority,
  }));

  const politicianEntries: MetadataRoute.Sitemap = ranking.map((p) => ({
    url: `${SITE_URL}/politicians/${p.id}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // 法案詳細を全件列挙する（議員ページと同方針。約532件と少なく、独自コンテンツの
  // インデックス促進が狙い。取得失敗時は空配列で固定ページのみ出力する）。
  const billEntries: MetadataRoute.Sitemap = billCodes.map((code) => ({
    url: `${SITE_URL}/bills/${encodeURIComponent(code)}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticEntries, ...politicianEntries, ...billEntries];
}
