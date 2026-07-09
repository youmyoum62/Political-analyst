import type { AxisBasis } from '@/lib/score-basis';
import { buildScoreBasis, hasAnyEvidence, type ScoreBasisInput } from '@/lib/score-basis';

/**
 * 議員詳細ページ「スコアの根拠」欄（A4）。
 * 各スコア軸の点数を、その議員の実カウント（提出法案・役職・AI評価発言）で裏付けて示す。
 * これは「この式でこの点数」という因果の提示ではなく、点数に関連する当サイト集計の
 * 実データの提示。裏付けデータが1軸も無ければ、既存のヒーロー注記と重複するため非表示。
 *
 * 既存の ScoreWeightsCard（ウェイトと寄与）や ScoreAxisLegend（汎用の軸定義）とは
 * 粒度・目的が異なり、こちらは「議員固有の実データ」に特化する。
 */
export function ScoreBasis({ input }: { input: ScoreBasisInput }) {
  const basis = buildScoreBasis(input);
  if (!hasAnyEvidence(basis)) return null;

  const evidence = basis.filter((b) => b.hasEvidence);
  const collecting = basis.filter((b) => !b.hasEvidence);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-xl font-black">スコアの根拠</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        各評価軸の点数の背景にある、この議員の活動データ（当サイトが一次情報から集計した実数）です。
      </p>

      <ul className="mt-4 space-y-3">
        {evidence.map((axis) => (
          <AxisBasisRow key={axis.key} axis={axis} />
        ))}
      </ul>

      {collecting.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-muted">
          次の軸は実データによる裏付けの提示を準備中です —{' '}
          {collecting.map((a) => a.label).join('・')}。
          {collecting.some((a) => a.note) && (
            <>
              {' '}
              {collecting
                .filter((a) => a.note)
                .map((a) => a.note)
                .join(' ')}
            </>
          )}
        </p>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-muted">
        出典: 衆議院/参議院「議案情報」・委員会/役職情報、国会会議録。件数は当サイトによる集計です。
        点数の算出方法は「評価軸の説明」を参照してください。
      </p>
    </section>
  );
}

function AxisBasisRow({ axis }: { axis: AxisBasis }) {
  return (
    <li className="rounded-xl border border-line bg-canvas p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-black text-ink">{axis.label}</span>
        <span className="shrink-0 text-sm font-black text-accent">
          {axis.score.toFixed(1)}
          <span className="ml-0.5 text-[11px] font-normal text-muted">点</span>
        </span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {axis.facts.map((fact) => (
          <li
            key={fact}
            className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted"
          >
            {fact}
          </li>
        ))}
      </ul>
    </li>
  );
}
