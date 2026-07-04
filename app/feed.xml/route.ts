/**
 * 「国会の動き」RSS 2.0 フィード。/v1/digest（トップページと同じデータ）を配信する。
 * リピーター獲得の最小施策。API 障害時は例外を投げず、空チャンネルを 200 で返す
 * （fetchDigest 自体がコールドスタート等をリトライ・吸収した上で null を返す設計のため、
 * ここでの null は「本当に取得できなかった」場合。RSS リーダーが継続購読しやすいよう
 * エラーステータスにはしない）。
 */

import { fetchDigest } from '@/lib/api-client';
import { buildRssXml, digestToFeedItems } from '@/lib/feed';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const revalidate = 3600;

export async function GET() {
  const digest = await fetchDigest();
  const items = digest ? digestToFeedItems(digest, SITE_URL) : [];

  const xml = buildRssXml({
    title: `${SITE_NAME} — 国会の動き`,
    link: SITE_URL,
    description: '国会の新着会議録・法案の動きをお届けするフィードです。',
    siteUrl: SITE_URL,
    items,
  });

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
