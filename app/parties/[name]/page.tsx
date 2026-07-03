import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchPartyDetail } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

const houseLabel = (house: string) =>
  house === 'representatives' ? '衆' : house === 'councillors' ? '参' : house;

export async function generateMetadata(
  { params }: { params: Promise<{ name: string }> },
): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const detail = await fetchPartyDetail(decoded);
  if (!detail) return { title: '政党が見つかりません' };
  const title = `${detail.name}の議員一覧とスコア分布`;
  const description = `${detail.name}の所属議員${detail.member_count}名（衆${detail.representatives}・参${detail.councillors}）の活動スコア。平均${detail.avg_score.toFixed(1)}点・中央値${detail.median_score.toFixed(1)}点（暫定値）。`;
  return {
    title,
    description,
    alternates: { canonical: `/parties/${encodeURIComponent(detail.name)}` },
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function PartyDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const detail = await fetchPartyDetail(decodeURIComponent(name));
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <Link href="/parties" className="text-sm font-semibold text-accent hover:underline">
        ← 政党一覧に戻る
      </Link>

      <section className="rounded-3xl border border-line bg-surface p-6">
        <h1 className="text-3xl font-black sm:text-4xl">{detail.name}</h1>
        <p className="mt-1 text-muted">
          所属{detail.member_count}名
          {detail.representatives ? ` ・ 衆議院${detail.representatives}` : ''}
          {detail.councillors ? ` ・ 参議院${detail.councillors}` : ''}
        </p>
        <div className="mt-4 flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">平均スコア</p>
            <p className="text-4xl font-black text-accent">{detail.avg_score.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">中央値</p>
            <p className="text-4xl font-black text-ink">{detail.median_score.toFixed(1)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">※ 出席・発言データ中心の暫定値です。政党間の優劣を示すものではありません。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-black">所属議員（スコア順）</h2>
        <ul className="space-y-1.5">
          {detail.members.map((m) => (
            <li key={m.id}>
              <Link
                href={`/politicians/${m.id}`}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition hover:border-muted"
              >
                <span className="shrink-0 rounded-md border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-bold text-muted">
                  {houseLabel(m.house)}
                </span>
                <span className="min-w-0 flex-1 font-semibold text-ink">{m.name}</span>
                <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(2, Math.min(100, m.final_score))}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right font-black text-accent">
                  {m.final_score.toFixed(1)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
