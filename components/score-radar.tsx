'use client';

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { Analysis } from '@/lib/types';

export function ScoreRadar({ analysis }: { analysis: Analysis }) {
  const data = [
    { metric: 'Activity', score: analysis.activity_score },
    { metric: 'Quality', score: analysis.question_quality_score },
    { metric: 'Legislative', score: analysis.legislative_score },
    { metric: 'Influence', score: analysis.influence_score },
    { metric: 'Policy', score: analysis.policy_impact_score }
  ];

  return (
    <section className="card">
      <h3 className="mb-4 text-lg font-semibold">Score Breakdown Radar</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="metric" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <Radar dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
