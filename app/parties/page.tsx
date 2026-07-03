import type { Metadata } from 'next';
import Link from 'next/link';

import { fetchParties } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '政党別のスコア分布',
  description:
    '政党ごとの所属議員数と活動スコアの平均・中央値、衆参の内訳。政党間の優劣ではなく分布を示します。スコアは公開データから算出した暫定値です。',
};

const HOUSE = (reps: number, coun: number) => {
  const parts: string[] = [];
  if (reps) parts.push(`衆${reps}`);
  if (coun) parts.push(`参${coun}`);
  return parts.join('・');
};

export default async function PartiesPage() {
  const parties = await fetchParties();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line bg-surface p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">政党別</p>
        <h1 className="text-3xl font-black sm:text-5xl">政党別のスコア分布</h1>
        <p className="mt-2 text-muted">
          政党ごとの所属議員数と活動スコアの平均・中央値です。会派間の優劣を示すものではなく、
          分布の目安として提供します。スコアは公開データから算出した暫定値です。
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {parties.map((p) => (
          <Link
            key={p.name}
            href={`/parties/${encodeURIComponent(p.name)}`}
            className="rounded-2xl border border-line bg-surface p-4 transition hover:border-muted"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-black">{p.name}</h2>
              <span className="shrink-0 text-sm text-muted">{p.member_count}名</span>
            </div>
            <p className="mt-1 text-xs text-muted">{HOUSE(p.representatives, p.councillors)}</p>
            <div className="mt-3 flex gap-4 text-sm">
              <span>
                平均 <span className="font-black text-accent">{p.avg_score.toFixed(1)}</span>
              </span>
              <span className="text-muted">
                中央値 <span className="font-bold text-ink">{p.median_score.toFixed(1)}</span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted">
        ※ 会派名は公開データのままで、一部に表記ゆれや要精査の値が含まれる場合があります。
      </p>
    </div>
  );
}
