/**
 * 全議員スコア CSV エクスポート用の純関数群。app/export.csv/route.ts から呼び出す。
 * CSV エスケープ規則: カンマ・ダブルクォート・改行(\n, \r)を含む値は "" で囲み、
 * 内部の " は "" にエスケープする（RFC 4180 相当）。
 */

import type { Politician } from '@/lib/types';

/** Excel で開いた際の文字化け（Shift_JIS 誤判定）を防ぐ UTF-8 BOM。 */
export const CSV_BOM = '﻿';

const HOUSE_LABELS: Record<Politician['house'], string> = {
  representatives: '衆議院',
  councillors: '参議院',
};

export function escapeCsvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',');
}

export const POLITICIAN_CSV_HEADERS = [
  '順位',
  '氏名',
  '党派',
  '院',
  '選挙区',
  '総合スコア',
  '議会参加',
  '発言品質',
  '立法実績',
  '政策実現',
  '影響力',
];

export function politicianToCsvRow(p: Politician): string {
  return buildCsvRow([
    p.rank,
    p.name,
    p.party,
    HOUSE_LABELS[p.house] ?? p.house,
    p.district,
    p.score,
    p.metrics.participation,
    p.metrics.questionQuality,
    p.metrics.legislation,
    p.metrics.policyImpact,
    p.metrics.influence,
  ]);
}

/**
 * 議員配列から CSV 全文（BOM 付き）を生成する。
 * politicians が空でもヘッダー行は必ず含む（API 障害時のフォールバック相当）。
 * opts.comment を渡すと、先頭に `#` 始まりの注記行（出典・ライセンス・暫定値の旨など）を付与する。
 */
export function buildPoliticiansCsv(
  politicians: Politician[],
  opts?: { comment?: string },
): string {
  const lines: string[] = [];
  if (opts?.comment) {
    for (const line of opts.comment.split('\n')) {
      lines.push(`# ${line}`);
    }
  }
  lines.push(buildCsvRow(POLITICIAN_CSV_HEADERS));
  for (const p of politicians) {
    lines.push(politicianToCsvRow(p));
  }
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}
