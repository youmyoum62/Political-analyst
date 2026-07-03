import Link from 'next/link';

/**
 * 信頼性ページ（about/methodology/privacy/disclaimer）共通のレイアウト枠。
 * 本文は読みやすさのため max-w-3xl に絞り、見出しは意味的な階層を保つ。
 */
export function ContentPage({
  title,
  lead,
  updated,
  children,
}: {
  title: string;
  lead?: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <Link href="/" className="text-sm font-semibold text-accent hover:underline">
        ← トップに戻る
      </Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-black sm:text-4xl">{title}</h1>
        {lead && <p className="text-muted">{lead}</p>}
        {updated && <p className="text-xs text-muted">最終更新: {updated}</p>}
      </header>
      <div className="space-y-8 text-sm leading-relaxed text-muted">{children}</div>
    </article>
  );
}

/** ContentPage 内の1セクション（h2 見出し＋本文）。 */
export function ContentSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-black text-ink">{heading}</h2>
      {children}
    </section>
  );
}
