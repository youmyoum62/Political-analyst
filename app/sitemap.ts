import type { MetadataRoute } from 'next';

import { fetchRankingSafe } from '@/lib/api-client';
import { SITE_URL } from '@/lib/site';

// sitemap は1時間ごとに再生成（議員の増減を反映）。API 不達でも空の議員一覧で
// 固定ページ分は必ず出力する（fetchRankingSafe が空配列を返す）。
export const revalidate = 3600;

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
