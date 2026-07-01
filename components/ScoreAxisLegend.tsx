const AXES = [
  {
    label: '議会参加',
    description: '質問数・発言数・委員会出席数など、議会活動への積極性を定量化',
  },
  {
    label: '発言品質',
    description: 'AIが評価した質問・発言の具体性・政策的深度・論拠の質',
  },
  {
    label: '立法実績',
    description: '法案提出数・共同提案数・委員会での審議関与度',
  },
  {
    label: '政策実現',
    description: '提出法案の可決率・成立した法案の影響度',
  },
  {
    label: '影響力',
    description: '委員長・副委員長・党幹部などの院内役職に基づく政治的影響力',
  },
];

export function ScoreAxisLegend() {
  return (
    <details className="rounded-2xl border border-line bg-surface p-4 group">
      <summary className="cursor-pointer list-none flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">評価軸の説明</span>
        <span className="text-xs text-muted group-open:hidden">
          <span aria-hidden="true">▼ </span>展開
        </span>
        <span className="text-xs text-muted hidden group-open:inline">
          <span aria-hidden="true">▲ </span>閉じる
        </span>
      </summary>
      <ul className="mt-3 space-y-2.5">
        {AXES.map((axis) => (
          <li key={axis.label} className="flex items-start gap-2.5 text-xs">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>
              <span className="font-semibold text-ink">{axis.label}</span>
              <span className="ml-1 text-muted">— {axis.description}</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
