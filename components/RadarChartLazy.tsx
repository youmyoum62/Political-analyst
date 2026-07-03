'use client';

import dynamic from 'next/dynamic';

import { PoliticianScoreBreakdown } from '@/lib/types';

// recharts（~45KB gzip）を初期バンドルから外し、必要時に遅延読込する。
// SSR 時は描画しない（recharts は client 幅に依存し、チャートは JS 必須のため）。
const RadarChart = dynamic(() => import('@/components/RadarChart').then((m) => m.RadarChart), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-2xl border border-line bg-surface" aria-hidden="true" />
  ),
});

export function RadarChartLazy({ metrics }: { metrics: PoliticianScoreBreakdown }) {
  return <RadarChart metrics={metrics} />;
}
