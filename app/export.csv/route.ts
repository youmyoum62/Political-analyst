/**
 * 全議員スコアの CSV ダウンロード。研究者・記者向けのデータ公開（データ/API freemium への布石）。
 * API 障害時も例外を投げず、ヘッダー行のみの CSV を 200 で返す
 * （RSS フィードと同じ方針：エラーステータスにせず、購読・利用側の処理を止めない）。
 */

import { fetchRanking } from '@/lib/api-client';
import { buildPoliticiansCsv } from '@/lib/csv';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import type { Politician } from '@/lib/types';

export const revalidate = 3600;

export async function GET() {
  let politicians: Politician[] = [];
  try {
    politicians = await fetchRanking();
  } catch {
    politicians = [];
  }

  const comment = [
    `${SITE_NAME} 全議員スコア CSV（${SITE_URL}）`,
    'スコアは公開データを基に当サイトが独自に算出した暫定値であり、各データ提供元の見解を示すものではありません。',
    '法案データの利用にあたり「スマートニュース メディア研究所」（MIT License）をデータ提供元として表示しています。',
    `生成日時: ${new Date().toISOString()}`,
  ].join('\n');

  const csv = buildPoliticiansCsv(politicians, { comment });

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="political-analyst-scores.csv"',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
