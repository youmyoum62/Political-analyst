import Link from 'next/link';

import type { BillListItem, Digest } from '@/lib/api-client';
import { billStatusLabel, billStatusTone, formatBillDate } from '@/lib/bills';
import { billStatusDistribution } from '@/lib/insights';

// 「直近の法案の動き」に出す最大件数（digest は 8 件前後返すため数件に絞る）。
const RECENT_LIMIT = 6;

/**
 * /bills 一覧ページ上部の「今国会の状況」サマリ。
 * - ステータスサマリ: ページが取得済みの全法案リストから集計（billStatusDistribution を再利用）。
 * - 直近の法案の動き: /v1/digest の bill イベント。digest.bills は id しか持たないため、
 *   一覧の id→bill_code 対応表で詳細ページ（/bills/[code]）へ内部リンクする。
 *   対応表に無い id はリンクせずテキスト表示にフォールバックする。
 * - 閉会中・データ 0 件でも壊れないよう各ブロックでフォールバックする（DietActivityFeed に準拠）。
 */
export function BillsDashboard({
  bills,
  digest,
}: {
  bills: BillListItem[];
  digest: Digest | null;
}) {
  const distribution = billStatusDistribution(bills);
  const total = bills.length;

  // digest.bills（id のみ保持）を詳細ページ（bill_code ベース）へ結ぶための対応表。
  const codeById = new Map(bills.map((b) => [b.id, b.bill_code]));

  const recent = (digest?.bills ?? []).slice(0, RECENT_LIMIT);

  return (
    <section
      aria-labelledby="bills-dashboard-heading"
      className="rounded-3xl border border-line bg-surface p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent">今国会の状況</p>
          <h2
            id="bills-dashboard-heading"
            className="mt-1 text-2xl font-black leading-tight sm:text-3xl"
          >
            法案のいま
          </h2>
        </div>
        {digest?.latest_activity_date && (
          <p className="text-xs text-muted">
            直近の記録: {formatBillDate(digest.latest_activity_date)}
          </p>
        )}
      </div>

      {digest && !digest.in_session && (
        <p className="mt-3 rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-muted">
          国会は閉会中の可能性があります。直近までに提出・審議された法案の集計を表示しています。
        </p>
      )}

      {/* ステータスサマリ */}
      {total > 0 ? (
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-line bg-canvas p-4">
            <dt className="text-xs font-semibold text-muted">総数</dt>
            <dd className="mt-1 text-2xl font-black text-ink">
              {total}
              <span className="ml-0.5 text-sm font-bold text-muted">件</span>
            </dd>
          </div>
          {distribution.map((d) => (
            <div key={d.status} className={`rounded-2xl border p-4 ${billStatusTone(d.status)}`}>
              <dt className="text-xs font-semibold">{billStatusLabel(d.status)}</dt>
              <dd className="mt-1 text-2xl font-black">
                {d.count}
                <span className="ml-0.5 text-sm font-bold opacity-70">件</span>
              </dd>
              <dd className="text-[11px] opacity-80">{d.percentage}%</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-5 rounded-2xl border border-line bg-canvas p-4 text-sm text-muted">
          現在表示できる法案データがありません。時間をおいて再度お試しください。
        </p>
      )}

      {/* 直近の法案の動き（digest の bill イベント） */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-accent">
          直近の法案の動き
        </h3>
        {recent.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {recent.map((bill) => {
              const code = codeById.get(bill.id);
              const meta = (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${billStatusTone(bill.status)}`}
                  >
                    {billStatusLabel(bill.status)}
                  </span>
                  {bill.date && (
                    <span className="text-xs text-muted">{formatBillDate(bill.date)}</span>
                  )}
                </div>
              );
              const title = <p className="mt-1.5 text-sm font-bold text-ink">{bill.title}</p>;
              return (
                <li key={bill.id}>
                  {code ? (
                    <Link
                      href={`/bills/${encodeURIComponent(code)}`}
                      className="block rounded-2xl border border-line bg-canvas p-3 transition hover:border-muted"
                    >
                      {meta}
                      {title}
                    </Link>
                  ) : (
                    <div className="rounded-2xl border border-line bg-canvas p-3">
                      {meta}
                      {title}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-line bg-canvas p-4 text-sm text-muted">
            直近の法案の動きはまだありません（閉会中の可能性があります）。
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-muted">
        出典: 国会議案データベース（スマートニュース メディア研究所、MIT License）。一次情報は衆議院・参議院
        公式「議案情報」。
      </p>
    </section>
  );
}
