import Link from 'next/link';

/**
 * AIが生成・論評した文章であることを明示する小さなラベル。
 * E-A-T/YMYL対応：どの文章がAI生成で、根拠となる一次データの出典をどこで確認できるかを示す。
 * スコア表示領域そのものではなく、要約・論評など地の文にAIが関与する箇所に添えて使う。
 */
export function AiGeneratedLabel({
  label = 'AI生成（一次データに基づく）',
  note = 'この文章は公開データを基にAIが生成・論評したものです。事実確認の一次情報は各項目に付す出典をご確認ください。',
  showNote = true,
  showLink = true,
  className = '',
}: {
  /** バッジ本体の文言。 */
  label?: string;
  /** バッジ下に添える補足文。null/空文字にすると本文なしでバッジのみ表示。 */
  note?: string;
  /** 補足文自体を出すかどうか（バッジのみ使いたい一覧行などでは false）。 */
  showNote?: boolean;
  /** 補足文の末尾に「データ・編集方針」へのリンクを添えるか。 */
  showLink?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line/70 bg-surface px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        {label}
      </span>
      {showNote && note && (
        <p className="text-xs leading-relaxed text-muted">
          {note}
          {showLink && (
            <>
              {' '}
              詳しくは
              <Link href="/editorial-policy" className="mx-1 text-accent hover:underline">
                データ・編集方針
              </Link>
              をご覧ください。
            </>
          )}
        </p>
      )}
    </div>
  );
}
