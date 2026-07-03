'use client';

import dynamic from 'next/dynamic';

import { ApiScoreHistoryPoint } from '@/lib/api-client';

const ScoreHistoryChart = dynamic(
  () => import('@/components/ScoreHistoryChart').then((m) => m.ScoreHistoryChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 w-full animate-pulse rounded-2xl border border-line bg-surface" aria-hidden="true" />
    ),
  },
);

export function ScoreHistoryChartLazy({ history }: { history: ApiScoreHistoryPoint[] }) {
  return <ScoreHistoryChart history={history} />;
}
