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
  // 折れ線として意味を持つには2期以上のスナップショットが必要
  if (history.length < 2) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface px-4 text-center text-sm text-muted">
        <span>スコア推移はデータ蓄積中です</span>
        <span className="text-xs text-muted">
          推移グラフの表示には2期以上のスコアスナップショットが必要です（現在 {history.length} 期）。
        </span>
      </div>
    );
  }

  const data = history.map((p) => ({
    label: p.period_start.slice(0, 7),
    score: Math.round(p.final_score * 10) / 10,
    rank: p.rank_snapshot,
  }));

  const first = data[0];
  const last = data[data.length - 1];
  const ariaLabel =
    `総合スコアの推移を示す折れ線グラフ。${first.label}は${first.score}点、` +
    `${last.label}は${last.score}点。全${data.length}期（0〜100点）。`;

  return (
    <div role="img" aria-label={ariaLabel} className="h-56 w-full rounded-2xl border border-line bg-surface p-4">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#34373a" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9a988f' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9a988f' }} />
          <Tooltip
            contentStyle={{ background: '#1f2123', border: '1px solid #34373a', borderRadius: 8 }}
            labelStyle={{ color: '#f1efe9', fontSize: 12 }}
            itemStyle={{ color: '#6ea8ff', fontSize: 12 }}
            formatter={(v: number) => [`${v}点`, 'スコア']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6ea8ff"
            strokeWidth={2}
            dot={{ r: 4, fill: '#6ea8ff', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
