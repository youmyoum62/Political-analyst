import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteFooter } from '@/components/SiteFooter';
import { checkA11y } from '../fixtures';

describe('SiteFooter', () => {
  it('信頼性ページ4本へのナビゲーションリンクを表示する', () => {
    render(<SiteFooter />);
    const expected: [string, string][] = [
      ['このサイトについて', '/about'],
      ['評価方法', '/methodology'],
      ['プライバシーポリシー', '/privacy'],
      ['免責事項', '/disclaimer'],
    ];
    for (const [label, href] of expected) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  it('データ出典の見出しを表示する', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('heading', { name: 'データ出典' })).toBeInTheDocument();
  });

  it('a11y 違反がない', async () => {
    const { container } = render(<SiteFooter />);
    expect(await checkA11y(container)).toHaveNoViolations();
  });
});
