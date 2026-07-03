import type { MetadataRoute } from 'next';

import { fetchRankingSafe } from '@/lib/api-client';
import { SITE_URL } from '@/lib/site';

// sitemap はリクエスト毎にランタイム生成する（ビルド時 prerender・ISR キャッシュを使わない）。
// ビルド時 or 長期キャッシュだと、Render コールドスタート中に生成された空版が固定され回復
// しない問題があった（home が runtime fetch で 718 を出せているのと同じ経路に揃える）。
// keep-warm cron で Render が常時温かいため、都度 fetch でも高速に全議員分を返す。
export const dynamic = 'force-dynamic';

const STATIC_ROUTES: { path: string; priority: number }[] = [
  { path: '', priority: 1 },
  { path: '/ranking', priority: 0.8 },
  { path: '/compare', priority: 0.6 },
  { path: '/about', priority: 0.4 },
  { path: '/methodology', priority: 0.5 },
  { path: '/privacy', priority: 0.3 },
  { path: '/disclaimer', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ranking = await fetchRankingSafe();

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

  return [...staticEntries, ...politicianEntries];
}
