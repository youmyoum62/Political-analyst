import type { MetadataRoute } from 'next';

import { fetchRankingSafe } from '@/lib/api-client';
import { SITE_URL } from '@/lib/site';

// sitemap は24時間ごとに再生成。Render 無料枠のコールドスタート(最大~104秒)は
// ビルド上限(60秒)も Vercel Hobby のファンクション上限(~60秒)も超えるため、単発の
// ランタイム再生成ではデータ取得を保証できない。短い revalidate だと5分ごとに
// コールドな API へ再生成を試み、失敗すると空へ戻る「フラッピング」を起こす。
// そこで長い revalidate にし、Render を温めた状態でビルドして取り込んだ良い版(全議員分)を
// 1日保持する。恒久策は Render の keep-warm cron（別タスク）。
export const revalidate = 86400;

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
