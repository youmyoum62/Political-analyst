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

  const ariaLabel =
    '5軸スコアのレーダーチャート。' +
    data.map((d) => `${d.key} ${d.value.toFixed(1)}点`).join('、') +
    '（各100点満点）。';

  return (
    <div role="img" aria-label={ariaLabel} className="h-72 w-full rounded-2xl border border-line bg-surface p-4">
      <ResponsiveContainer>
        <Chart data={data} outerRadius="72%">
          <PolarGrid stroke="#34373a" />
          <PolarAngleAxis dataKey="key" stroke="#f1efe9" tick={{ fontSize: 12 }} />
          <Radar dataKey="value" stroke="#6ea8ff" fill="#6ea8ff" fillOpacity={0.35} />
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
