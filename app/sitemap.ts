import type { MetadataRoute } from 'next';

import { fetchRankingSafe } from '@/lib/api-client';
import { SITE_URL } from '@/lib/site';

// sitemap は5分ごとに再生成。API 不達でも固定ページ分は必ず出力し（fetchRankingSafe が
// 空配列を返す）、コールドスタート中にビルドされ議員URLが欠けても、次の再生成
// （ランタイム120秒タイムアウトでコールドスタートを吸収）で全議員分に速やかに回復する。
export const revalidate = 300;

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
