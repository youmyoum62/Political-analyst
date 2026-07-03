import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DietActivityFeed } from '@/components/DietActivityFeed';
import type { Digest } from '@/lib/api-client';
import { checkA11y } from '../fixtures';

function makeDigest(overrides: Partial<Digest> = {}): Digest {
  return {
    generated_at: '2026-07-03T00:00:00',
    latest_activity_date: '2026-06-20',
    in_session: true,
    minutes: [
      {
        date: '2026-06-20',
        speaker_count: 2,
        speakers: [
          { politician_id: 7, name: '山田太郎', party: '自民', activity_type: 'question', source_url: 'https://kokkai.example/1' },
          { politician_id: 9, name: '佐藤花子', party: '立憲', activity_type: 'speech', source_url: 'https://kokkai.example/2' },
        ],
      },
    ],
    bills: [
      { id: 1, title: '〇〇法改正案', status: 'passed', date: '2026-06-18', source_url: 'https://shugiin.example/1' },
    ],
    ...overrides,
  };
}

describe('DietActivityFeed', () => {
  it('digest が null なら何も描画しない', () => {
    const { container } = render(<DietActivityFeed digest={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('会議録と法案がなければ何も描画しない', () => {
    const { container } = render(
      <DietActivityFeed digest={makeDigest({ minutes: [], bills: [] })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('発言者を議員ページへのリンクとして表示する（回遊導線）', () => {
    render(<DietActivityFeed digest={makeDigest()} />);
    expect(screen.getByRole('heading', { name: '国会の動き' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /山田太郎/ })).toHaveAttribute('href', '/politicians/7');
    expect(screen.getByRole('link', { name: /佐藤花子/ })).toHaveAttribute('href', '/politicians/9');
  });

  it('法案の状態と出典リンクを表示する', () => {
    render(<DietActivityFeed digest={makeDigest()} />);
    expect(screen.getByText('成立・可決')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '〇〇法改正案' })).toHaveAttribute('href', 'https://shugiin.example/1');
  });

  it('閉会中は注記を表示する', () => {
    render(<DietActivityFeed digest={makeDigest({ in_session: false })} />);
    expect(screen.getByText(/閉会中の可能性/)).toBeInTheDocument();
  });

  it('在会中は閉会中の注記を表示しない', () => {
    render(<DietActivityFeed digest={makeDigest({ in_session: true })} />);
    expect(screen.queryByText(/閉会中の可能性/)).toBeNull();
  });

  it('a11y 違反がない', async () => {
    const { container } = render(<DietActivityFeed digest={makeDigest()} />);
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
