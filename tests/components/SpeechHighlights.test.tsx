import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpeechHighlights } from '@/components/SpeechHighlights';
import type { TopSpeech } from '@/lib/api-client';
import { checkA11y } from '../fixtures';

function makeSpeech(overrides: Partial<TopSpeech> = {}): TopSpeech {
  return {
    activity_id: 1,
    activity_type: 'question',
    session_date: '2026-06-20',
    excerpt: '子育て支援の予算配分について政府の見解を問う。',
    score: 82.5,
    confidence: 0.9,
    rationale: '具体的なデータに基づき論点を明確にした質問である。',
    source_url: 'https://kokkai.example/1',
    ...overrides,
  };
}

describe('SpeechHighlights', () => {
  it('発言が空なら何も描画しない', () => {
    const { container } = render(<SpeechHighlights speeches={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('抜粋・会議日・出典リンクを表示する', () => {
    render(<SpeechHighlights speeches={[makeSpeech()]} />);
    expect(screen.getByRole('heading', { name: '発言ハイライト' })).toBeInTheDocument();
    expect(screen.getByText(/子育て支援の予算配分/)).toBeInTheDocument();
    expect(screen.getByText('2026年6月20日')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /国会会議録で読む/ })).toHaveAttribute(
      'href',
      'https://kokkai.example/1',
    );
  });

  it('出典リンクは新規タブ＋noopenerで開く', () => {
    render(<SpeechHighlights speeches={[makeSpeech()]} />);
    const link = screen.getByRole('link', { name: /国会会議録で読む/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('rationale がある発言には「AIによる論評」ラベルと論評本文を表示する', () => {
    render(<SpeechHighlights speeches={[makeSpeech()]} />);
    expect(screen.getByText('AIによる論評')).toBeInTheDocument();
    expect(screen.getByText(/具体的なデータに基づき論点/)).toBeInTheDocument();
  });

  it('rationale が null の発言は論評を出さず抜粋・出典のみ表示する', () => {
    render(<SpeechHighlights speeches={[makeSpeech({ rationale: null })]} />);
    expect(screen.queryByText('AIによる論評')).toBeNull();
    expect(screen.getByText(/子育て支援の予算配分/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /国会会議録で読む/ })).toBeInTheDocument();
  });

  it('source_url が null なら出典リンクを出さない', () => {
    render(<SpeechHighlights speeches={[makeSpeech({ source_url: null })]} />);
    expect(screen.queryByRole('link', { name: /国会会議録で読む/ })).toBeNull();
  });

  it('a11y 違反がない', async () => {
    const { container } = render(
      <SpeechHighlights speeches={[makeSpeech(), makeSpeech({ activity_id: 2, rationale: null })]} />,
    );
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
