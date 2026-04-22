import { Analysis } from '@/lib/types';

const scoreMap: { key: keyof Analysis; label: string }[] = [
  { key: 'activity_score', label: 'Activity' },
  { key: 'question_quality_score', label: 'Question Quality' },
  { key: 'legislative_score', label: 'Legislative' },
  { key: 'influence_score', label: 'Influence' },
  { key: 'policy_impact_score', label: 'Policy Impact' }
];

export function ScoreCards({ analysis }: { analysis: Analysis }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {scoreMap.map(({ key, label }) => (
        <div key={key} className="card">
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{analysis[key].toFixed(1)}</p>
        </div>
      ))}
    </section>
  );
}
