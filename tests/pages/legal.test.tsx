import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MethodologyPage from '@/app/methodology/page';
import AboutPage from '@/app/about/page';
import PrivacyPage from '@/app/privacy/page';
import DisclaimerPage from '@/app/disclaimer/page';
import { checkA11y } from '../fixtures';

describe('信頼性ページ', () => {
  it('評価方法ページが5軸と役割プロファイル別ウェイトを表示する', () => {
    render(<MethodologyPage />);
    expect(screen.getByRole('heading', { level: 1, name: '評価方法' })).toBeInTheDocument();
    // 5軸（テーブル見出しとリストで複数箇所に出る）。
    for (const axis of ['議会参加', '発言品質', '立法実績', '政策実現', '影響力']) {
      expect(screen.getAllByText(new RegExp(axis)).length).toBeGreaterThan(0);
    }
    // 役割プロファイル4種（セル内でネストするため getAllByText で存在を確認）。
    for (const profile of ['野党一般', '与党一般', '閣僚', '議会役職']) {
      expect(screen.getAllByText(new RegExp(profile)).length).toBeGreaterThan(0);
    }
  });

  it('各ページが h1 見出しと免責の趣旨を持つ', () => {
    const about = render(<AboutPage />);
    expect(about.getByRole('heading', { level: 1, name: 'このサイトについて' })).toBeInTheDocument();
    expect(about.getByText(/金銭で順位は動きません/)).toBeInTheDocument();

    const privacy = render(<PrivacyPage />);
    expect(privacy.getByRole('heading', { level: 1, name: 'プライバシーポリシー' })).toBeInTheDocument();

    const disclaimer = render(<DisclaimerPage />);
    expect(disclaimer.getByRole('heading', { level: 1, name: '免責事項' })).toBeInTheDocument();
    expect(disclaimer.getByText(/暫定値/)).toBeInTheDocument();
  });

  it('4ページとも a11y 違反がない', async () => {
    for (const Page of [MethodologyPage, AboutPage, PrivacyPage, DisclaimerPage]) {
      const { container } = render(<Page />);
      expect(await checkA11y(container)).toHaveNoViolations();
    }
  });
});
