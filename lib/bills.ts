/**
 * 法案（議案）ページ用の表示ヘルパー。
 * status / role の実 API 値（本番 /v1/bills で確認）を日本語ラベルとバッジ色に変換する。
 * 一覧・詳細ページとテストで共有する。
 */

/** status の実データ値 → 日本語ラベル。本番 API の分布: passed / in_committee / submitted / withdrawn。 */
export const BILL_STATUS_LABELS: Record<string, string> = {
  passed: '成立',
  in_committee: '審議中',
  submitted: '提出',
  withdrawn: '撤回',
};

export function billStatusLabel(status: string): string {
  return BILL_STATUS_LABELS[status] ?? status;
}

/**
 * バッジのトーン（デザイントークン）。中立・報道調。
 * 既存の順位変動バッジ（bg-up/10 text-up 等）と同じ配色語彙に揃える。
 */
export const BILL_STATUS_TONE: Record<string, string> = {
  passed: 'border-up/40 bg-up/10 text-up',
  in_committee: 'border-accent/40 bg-accent/10 text-accent',
  submitted: 'border-accent2/40 bg-accent2/10 text-accent2',
  withdrawn: 'border-line bg-canvas text-muted',
};

export function billStatusTone(status: string): string {
  return BILL_STATUS_TONE[status] ?? 'border-line bg-canvas text-muted';
}

/** 一覧フィルタのタブ順（実データの件数分布の多い順）。 */
export const BILL_STATUS_ORDER = ['passed', 'in_committee', 'submitted', 'withdrawn'] as const;

/** sponsors の role 実データ値 → 日本語ラベル。本番 API の値: primary / co。 */
export const BILL_ROLE_LABELS: Record<string, string> = {
  primary: '提出者',
  co: '賛成者・共同提出者',
  committee: '委員会提出',
};

export function billRoleLabel(role: string): string {
  return BILL_ROLE_LABELS[role] ?? role;
}

/** ISO 日付文字列（YYYY-MM-DD…）を「2026年6月3日」形式に。null は「—」。 */
export function formatBillDate(d: string | null): string {
  if (!d) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}
