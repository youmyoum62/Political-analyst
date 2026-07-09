import { AiGeneratedLabel } from '@/components/AiGeneratedLabel';
import type { TopSpeech } from '@/lib/api-client';

const ACTIVITY_LABELS: Record<string, string> = {
  question: '質問',
  speech: '発言',
};

function formatDate(iso: string | null): string | null {
  // 'YYYY-MM-DD' を素朴に整形（タイムゾーンずれを避けるため Date を使わない）。
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${y}年${Number(m)}月${Number(d)}日`;
}

/**
 * 議員詳細ページの「発言ハイライト」欄（独自コンテンツの中核）。
 * AI品質評価つきの発言・質問を「原文抜粋＋AIによる論評＋会議日・出典」で掲載する。
 * データが無い議員（未評価）ではセクションごと非表示にする。
 */
export function SpeechHighlights({ speeches }: { speeches: TopSpeech[] }) {
  if (!speeches || speeches.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-black">発言ハイライト</h2>
        <p className="text-xs text-muted">AI評価で注目度の高い発言・質問</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        国会会議録から、この議員の発言・質問をAIが評価し、注目度の高いものを抜粋・論評しています。
      </p>

      <ul className="mt-4 space-y-4">
        {speeches.map((sp) => {
          const typeLabel = ACTIVITY_LABELS[sp.activity_type] ?? sp.activity_type;
          const dateLabel = formatDate(sp.session_date);
          const excerpt = sp.excerpt?.trim();
          if (!excerpt) return null;

          return (
            <li
              key={sp.activity_id}
              className="rounded-xl border border-line bg-canvas p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-line px-2 py-0.5 font-bold text-accent">
                  {typeLabel}
                </span>
                {dateLabel && <span className="text-muted">{dateLabel}</span>}
                {sp.score != null && (
                  <span className="ml-auto text-muted">
                    AI評価スコア{' '}
                    <span className="font-bold text-accent2">{sp.score.toFixed(1)}</span>
                    {sp.confidence != null && (
                      <span className="ml-1 text-[10px]">
                        （確信度 {(sp.confidence * 100).toFixed(0)}%）
                      </span>
                    )}
                  </span>
                )}
              </div>

              <blockquote className="mt-3 border-l-2 border-line pl-3 text-sm leading-relaxed text-ink">
                {excerpt}
                {excerpt.length >= 200 && <span className="text-muted">…</span>}
              </blockquote>

              {sp.rationale?.trim() && (
                <div className="mt-3 rounded-lg border border-line/70 bg-surface p-3">
                  <AiGeneratedLabel
                    label="AIによる論評"
                    showNote={false}
                    className="mb-1.5"
                  />
                  <p className="text-sm leading-relaxed text-muted">
                    {sp.rationale.trim()}
                  </p>
                </div>
              )}

              {sp.source_url && (
                <p className="mt-3 text-xs">
                  <a
                    href={sp.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-accent hover:underline"
                  >
                    国会会議録で読む（出典）
                  </a>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <AiGeneratedLabel
        className="mt-4"
        note="発言の抜粋・出典は国会会議録に基づく一次情報です。各発言の論評とスコアは、抜粋本文を基にAIが生成・評価したものです。"
      />
    </section>
  );
}
