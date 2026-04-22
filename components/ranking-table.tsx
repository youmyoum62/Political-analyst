import Link from 'next/link';
import { RankingRow } from '@/lib/types';

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  return (
    <section className="card overflow-x-auto">
      <h2 className="mb-4 text-xl font-semibold">Top Politicians</h2>
      <table className="min-w-full text-left text-sm">
        <thead className="text-slate-400">
          <tr className="border-b border-slate-800">
            <th className="px-2 py-3">Rank</th>
            <th className="px-2 py-3">Name</th>
            <th className="px-2 py-3">Party</th>
            <th className="px-2 py-3">Final Score</th>
            <th className="px-2 py-3">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.politician_id} className="border-b border-slate-900 hover:bg-slate-800/40">
              <td className="px-2 py-3 font-semibold">#{row.rank}</td>
              <td className="px-2 py-3">
                <Link className="text-sky-300 hover:underline" href={`/politicians/${row.politician_id}`}>
                  {row.name}
                </Link>
              </td>
              <td className="px-2 py-3">{row.party}</td>
              <td className="px-2 py-3">{row.final_score.toFixed(1)}</td>
              <td className={`px-2 py-3 ${row.trend >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {row.trend >= 0 ? `+${row.trend}` : row.trend}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
