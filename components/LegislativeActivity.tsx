import Link from 'next/link';

import type { PoliticianBill } from '@/lib/api-client';
import { billRoleLabel, billStatusLabel, billStatusTone, formatBillDate } from '@/lib/bills';

/**
 * 議員詳細ページの「立法活動」欄。提出・共同提出した法案を役割・ステータス・提出日つきで一覧。
 * 法案名は法案ページ /bills/[bill_code] への内部リンク。
 * データが無い議員ではセクションごと非表示にする。
 */
export function LegislativeActivity({ bills }: { bills: PoliticianBill[] }) {
  if (!bills || bills.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-black">立法活動</h2>
        <p className="text-xs text-muted">提出・共同提出した法案 {bills.length} 件</p>
      </div>

      <ul className="mt-4 space-y-2">
        {bills.map((bill) => (
          <li
            key={bill.bill_id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm"
          >
            <span className="shrink-0 text-xs font-bold text-muted">
              {billRoleLabel(bill.role)}
            </span>
            <Link
              href={`/bills/${encodeURIComponent(bill.bill_code)}`}
              className="min-w-0 flex-1 basis-full font-semibold text-ink hover:text-accent hover:underline sm:basis-0"
            >
              {bill.title}
            </Link>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${billStatusTone(bill.status)}`}
            >
              {billStatusLabel(bill.status)}
            </span>
            <span className="shrink-0 text-xs text-muted">{formatBillDate(bill.submitted_date)}</span>
          </li>
        ))}
      </ul>

      {bills.length >= 30 && (
        <p className="mt-3 text-[11px] text-muted">
          ※ 提出日の新しい順に30件まで表示しています。
        </p>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-muted">
        出典: 衆議院/参議院「議案情報」。掲載は当サイトによる集計です。
      </p>
    </section>
  );
}
