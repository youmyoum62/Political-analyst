'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { BillListItem } from '@/lib/api-client';
import {
  BILL_STATUS_ORDER,
  billStatusLabel,
  billStatusTone,
  formatBillDate,
} from '@/lib/bills';

// 全件（最大532件）を一括描画すると負荷が高いため段階表示にする。
// /ranking の「さらに表示」60件ずつと同じ流儀。
const PAGE_SIZE = 60;

export function BillsFeed({ bills }: { bills: BillListItem[] }) {
  const [status, setStatus] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // 提出日の新しい順（null は末尾）。localeCompare で YYYY-MM-DD を降順ソート。
  const sorted = useMemo(
    () =>
      [...bills].sort((a, b) =>
        (b.submitted_date ?? '').localeCompare(a.submitted_date ?? ''),
      ),
    [bills],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bills.length };
    for (const b of bills) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [bills]);

  const filtered = useMemo(
    () => (status === 'all' ? sorted : sorted.filter((b) => b.status === status)),
    [sorted, status],
  );

  // フィルタ変更で表示件数を初期化（RankingFeed と同じ「レンダー中に前回値と比較」パターン。
  // useEffect だと一瞬フル件数が見えるちらつきが出るため避ける）。
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    setVisibleCount(PAGE_SIZE);
  }

  const displayed = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;

  const tabs: { key: string; label: string }[] = [
    { key: 'all', label: 'すべて' },
    ...BILL_STATUS_ORDER.map((s) => ({ key: s, label: billStatusLabel(s) })),
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-accent">国会議案データベース</p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-5xl">法案・議案</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          国会に提出された法案の一覧です。ステータスで絞り込み、提出者から議員ページへたどれます。
          データは衆議院・参議院の公式「議案情報」に由来します。
        </p>
      </section>

      <section className="space-y-3">
        <div
          role="group"
          aria-label="ステータスで絞り込み"
          className="flex flex-wrap gap-2"
        >
          {tabs.map((t) => {
            const active = status === t.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(t.key)}
                className={`rounded-full border px-4 py-1.5 text-sm font-bold transition ${
                  active
                    ? 'border-accent bg-accent text-canvas'
                    : 'border-line bg-surface text-muted hover:border-muted hover:text-ink'
                }`}
              >
                {t.label}
                <span className={`ml-1.5 text-xs font-semibold ${active ? 'text-canvas/80' : 'text-muted'}`}>
                  {counts[t.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-sm text-muted">
          {filtered.length}件
          {status !== 'all' && `（${billStatusLabel(status)}）`}
        </p>

        {displayed.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
            該当する法案がありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {displayed.map((bill) => (
              <li key={bill.bill_code}>
                <Link
                  href={`/bills/${encodeURIComponent(bill.bill_code)}`}
                  className="block rounded-2xl border border-line bg-surface p-4 transition hover:border-muted"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${billStatusTone(bill.status)}`}
                    >
                      {billStatusLabel(bill.status)}
                    </span>
                    <span className="text-xs text-muted">{formatBillDate(bill.submitted_date)} 提出</span>
                    {bill.sponsor_count > 0 && (
                      <span className="text-xs text-muted">提出者・賛成者 {bill.sponsor_count}名</span>
                    )}
                  </div>
                  <p className="mt-1.5 font-bold text-ink">{bill.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            aria-label={`さらに表示（残り${remaining}件）`}
            className="flex w-full items-center justify-center rounded-2xl border border-line bg-surface p-4 text-sm font-bold text-accent transition hover:border-muted"
          >
            さらに表示（残り{remaining}件）
          </button>
        )}
      </section>

      <p className="text-xs text-muted">
        出典: 国会議案データベース（スマートニュース メディア研究所、MIT License）。一次情報は衆議院・参議院 公式「議案情報」。
      </p>
    </div>
  );
}
