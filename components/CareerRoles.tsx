import type { PoliticianRole } from '@/lib/api-client';

const SCOPE_LABELS: Record<string, string> = {
  committee: '委員会',
  party: '党',
  parliament: '院',
};

function formatDate(iso: string | null): string | null {
  // 'YYYY-MM-DD' を素朴に整形（タイムゾーンずれを避けるため Date を使わない）。
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${y}年${Number(m)}月`;
}

function periodLabel(start: string | null, end: string | null): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return `${s}〜${e}`;
  if (s) return `${s}〜現任`;
  if (e) return `〜${e}`;
  return '';
}

/**
 * 議員詳細ページの「役職・キャリア」欄。委員会・党・院の役職を時系列（新しい順）で表示。
 * end_date が null の役職は「現任」扱い。
 * データが無い議員ではセクションごと非表示にする。
 */
export function CareerRoles({ roles }: { roles: PoliticianRole[] }) {
  if (!roles || roles.length === 0) return null;

  // 開始日の新しい順（開始日不明は末尾）に並べる。
  const sorted = [...roles].sort((a, b) => {
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  });

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-xl font-black">役職・キャリア</h2>

      <ul className="mt-4 space-y-2">
        {sorted.map((role, i) => {
          const scope = SCOPE_LABELS[role.role_scope] ?? role.role_scope;
          const period = periodLabel(role.start_date, role.end_date);
          const current = role.end_date == null;

          return (
            <li
              key={`${role.role_scope}-${role.role_name}-${role.start_date ?? i}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm"
            >
              <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-bold text-muted">
                {scope}
              </span>
              <span className="font-semibold text-ink">{role.role_name}</span>
              {current && (
                <span className="shrink-0 text-xs font-bold text-up">現任</span>
              )}
              {period && (
                <span className="ml-auto shrink-0 text-xs text-muted">{period}</span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[10px] leading-relaxed text-muted">
        出典: 衆議院/参議院の委員会・役職情報。掲載は当サイトによる集計です。
      </p>
    </section>
  );
}
