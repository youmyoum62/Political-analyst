/**
 * AdSense の ads.txt。承認済み販売者として自ドメインの広告在庫の正当性を示す
 * （なりすまし在庫対策。AdSense が設置を推奨）。ADSENSE_PUBLISHER_ID 未設定時は 404 を返す。
 * f08c47fec0942fa0 は Google の固定 TAG-ID。
 */

import { ADSENSE_PUBLISHER_ID } from '@/lib/site';

export const dynamic = 'force-static';

export function GET() {
  if (!ADSENSE_PUBLISHER_ID) {
    return new Response('Not found', { status: 404 });
  }

  // ads.txt には "pub-XXXX" 形式（先頭の "ca-" を除いた publisher id）を記載する。
  const pubId = ADSENSE_PUBLISHER_ID.replace(/^ca-/, '');
  const body = `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
