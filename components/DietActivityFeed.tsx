import Link from 'next/link';

import { Digest } from '@/lib/api-client';

const ACTIVITY_LABELS: Record<string, string> = {
  question: '質問',
  speech: '発言',
  committee_action: '委員会',
};

const BILL_STATUS: Record<string, { label: string; className: string }> = {
  submitted: { label: '提出', className: 'text-muted' },
  in_committee: { label: '委員会審議中', className: 'text-accent' },
  passed: { label: '成立・可決', className: 'text-up' },
  rejected: { label: '否決', className: 'text-down' },
  withdrawn: { label: '撤回', className: 'text-muted' },
};

function formatDate(iso: string): string {
  // 'YYYY-MM-DD' を素朴に整形（タイムゾーンずれを避けるため Date を使わない）。
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export function DietActivityFeed({ digest }: { digest: Digest | null }) {
  if (!digest) return null;
  const hasMinutes = digest.minutes.length > 0;
  const hasBills = digest.bills.length > 0;
  if (!hasMinutes && !hasBills) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-black">国会の動き</h2>
        {digest.latest_activity_date && (
          <p className="text-xs text-muted">
            直近の記録: {formatDate(digest.latest_activity_date)}
          </p>
        )}
      </div>

      {!digest.in_session && (
        <p className="mt-2 rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-muted">
          国会は閉会中の可能性があります。直近の会議録・法案の記録を表示しています。
        </p>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {/* 新着会議録：発言した議員 → スコアページへ */}
        {hasMinutes && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-accent">新着会議録</h3>
            <div className="mt-2 space-y-3">
              {digest.minutes.map((day) => (
                <div key={day.date}>
                  <p className="text-xs font-semibold text-muted">{formatDate(day.date)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {day.speakers.map((sp) => (
                      <Link
                        key={`${day.date}-${sp.politician_id}`}
                        href={`/politicians/${sp.politician_id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-0.5 text-xs transition hover:border-muted"
                      >
                        <span className="font-semibold text-ink">{sp.name}</span>
                        {sp.party && <span className="text-muted">{sp.party}</span>}
                        <span className="text-[10px] text-muted">
                          {ACTIVITY_LABELS[sp.activity_type] ?? sp.activity_type}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 法案の動き */}
        {hasBills && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-accent">法案の動き</h3>
            <ul className="mt-2 space-y-2">
              {digest.bills.map((bill) => {
                const status = BILL_STATUS[bill.status] ?? { label: bill.status, className: 'text-muted' };
                return (
                  <li key={bill.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 shrink-0 text-xs font-bold ${status.className}`}>
                      {status.label}
                    </span>
                    <span className="min-w-0">
                      {bill.source_url ? (
                        <a
                          href={bill.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink hover:text-accent hover:underline"
                        >
                          {bill.title}
                        </a>
                      ) : (
                        <span className="text-ink">{bill.title}</span>
                      )}
                      {bill.date && <span className="ml-1 text-xs text-muted">（{formatDate(bill.date)}）</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-muted">
        出典: 国立国会図書館「国会会議録検索システム」・衆議院/参議院「議案情報」（スマートニュース
        メディア研究所「国会議案データベース」を含む）。掲載は当サイトによる集計です。
      </p>
    </section>
  );
}
