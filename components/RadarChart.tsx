'use client';

import { PolarAngleAxis, PolarGrid, Radar, RadarChart as Chart, ResponsiveContainer } from 'recharts';

import { PoliticianScoreBreakdown } from '@/lib/types';

export function RadarChart({ metrics }: { metrics: PoliticianScoreBreakdown }) {
  const data = [
    { key: '議会参加', value: metrics.participation },
    { key: '発言品質', value: metrics.questionQuality },
    { key: '立法実績', value: metrics.legislation },
    { key: '政策実現', value: metrics.policyImpact },
    { key: '影響力',   value: metrics.influence },
  ];

  return (
    <div className="h-72 w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <ResponsiveContainer>
        <Chart data={data} outerRadius="72%">
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis dataKey="key" stroke="#e2e8f0" tick={{ fontSize: 12 }} />
          <Radar dataKey="value" stroke="#22d3ee" fill="#06b6d4" fillOpacity={0.45} />
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
