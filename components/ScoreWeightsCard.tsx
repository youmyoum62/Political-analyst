import { ApiAnalysis } from '@/lib/api-client';

const AXIS_LABELS: Record<string, string> = {
  participation: '議会参加',
  quality: '発言品質',
  legislative: '立法実績',
  policy_impact: '政策実現',
  influence: '影響力',
};

const SCORE_KEYS: Array<keyof ApiAnalysis['weights']> = [
  'participation', 'quality', 'legislative', 'policy_impact', 'influence',
];

const SCORE_VALUES: Record<keyof ApiAnalysis['weights'], keyof ApiAnalysis> = {
  participation: 'participation_score',
  quality: 'quality_score',
  legislative: 'legislative_score',
  policy_impact: 'policy_impact_score',
  influence: 'influence_score',
};

function barWidth(score: number): string {
  return `${Math.max(2, Math.round(score))}%`;
}

export function ScoreWeightsCard({ analysis }: { analysis: ApiAnalysis }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-lg font-black">スコア内訳 &amp; 評価ウェイト</h3>
      <p className="mt-1 text-xs text-muted">
        役割プロファイル: <span className="font-semibold text-ink">{analysis.role_profile}</span>
        　最終スコア: <span className="font-semibold text-accent">{analysis.final_score.toFixed(1)}</span>
      </p>

      <div className="mt-4 space-y-3">
        {SCORE_KEYS.map((key) => {
          const score = analysis[SCORE_VALUES[key]] as number;
          const weight = analysis.weights[key];
          const contribution = score * weight;

          return (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-ink">
                  {AXIS_LABELS[key]}
                  <span className="ml-2 text-muted">（ウェイト {(weight * 100).toFixed(0)}%）</span>
                </span>
                <span className="font-black text-accent">
                  {score.toFixed(1)}
                  <span className="ml-1 text-muted font-normal">
                    → {contribution.toFixed(1)}pt
                  </span>
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.round(score)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${score.toFixed(1)}点`}
                aria-label={`${AXIS_LABELS[key]}スコア`}
                className="h-1.5 w-full rounded-full bg-canvas"
              >
                <div
                  className="h-1.5 rounded-full bg-accent transition-all"
                  style={{ width: barWidth(score) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] text-muted">
        ※ ウェイトは役割プロファイルにより異なります。寄与 = スコア × ウェイト。
      </p>
    </div>
  );
}
