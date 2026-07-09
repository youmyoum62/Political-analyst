import Link from 'next/link';

/**
 * 分析記事（/insights）で使う横棒の分布表示。
 * recharts を持ち込まず CSS バーで軽量に描く（記事は静的な集計表示が中心で、
 * インタラクションは不要。ダーク/ライト両対応のデザイントークンを使う）。
 *
 * 各行はラベル・値・バーからなり、バー幅は max に対する value の割合。
 * href があればラベルをリンクにする（議員ページ・政党ページへの内部リンク）。
 */

export type StatBarItem = {
  key: string;
  label: string;
  /** バー幅を決める値。 */
  value: number;
  /** 値の右側に出す表示文字列（件数＋割合など）。未指定なら value を表示。 */
  valueLabel?: string;
  /** バーの色クラス（デザイントークン）。未指定は accent。 */
  barClassName?: string;
  href?: string;
};

export function StatBarList({
  items,
  max,
  caption,
}: {
  items: StatBarItem[];
  /** バー幅の基準となる最大値。未指定なら items の value 最大。 */
  max?: number;
  /** スクリーンリーダー向けの表の説明。 */
  caption?: string;
}) {
  const ceiling = max ?? Math.max(1, ...items.map((i) => i.value));

  return (
    <ul className="space-y-2.5" aria-label={caption}>
      {items.map((item) => {
        const width = `${Math.max(2, Math.min(100, (item.value / ceiling) * 100))}%`;
        const label = item.href ? (
          <Link href={item.href} className="font-semibold text-ink hover:text-accent hover:underline">
            {item.label}
          </Link>
        ) : (
          <span className="font-semibold text-ink">{item.label}</span>
        );
        return (
          <li key={item.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {label}
              <span className="shrink-0 tabular-nums text-muted">{item.valueLabel ?? item.value}</span>
            </div>
            <span className="block h-2 w-full overflow-hidden rounded-full bg-canvas" aria-hidden="true">
              <span
                className={`block h-full rounded-full ${item.barClassName ?? 'bg-accent'}`}
                style={{ width }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
