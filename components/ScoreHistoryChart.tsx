'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ApiScoreHistoryPoint } from '@/lib/api-client';

type Props = {
  history: ApiScoreHistoryPoint[];
};

export function ScoreHistoryChart({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/60 text-sm text-slate-400">
        スコア履歴がまだありません
      </div>
    );
  }

  const data = history.map((p) => ({
    label: p.period_start.slice(0, 7),
    score: Math.round(p.final_score * 10) / 10,
    rank: p.rank_snapshot,
  }));

  return (
    <div className="h-56 w-full rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0', fontSize: 12 }}
            itemStyle={{ color: '#22d3ee', fontSize: 12 }}
            formatter={(v: number) => [`${v}点`, 'スコア']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ r: 4, fill: '#22d3ee', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
