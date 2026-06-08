import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, expect, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// jest-axe の a11y マッチャを vitest の expect に登録する。
expect.extend(toHaveNoViolations);

// recharts の ResponsiveContainer が参照する ResizeObserver は jsdom に存在しないため、
// 最小スタブを用意する（サイズ測定は 0 のままだが描画自体はエラーにならない）。
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

// next/link はテストでは単純な <a> として扱う。
// prefetch 等の副作用（jsdom 外の API 参照や act 警告）を避けつつ href/aria を検証できる。
vi.mock('next/link', () => ({
  __esModule: true,
  default: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
    function MockLink({ children, ...props }, ref) {
      return React.createElement('a', { ...props, ref }, children);
    },
  ),
}));

// 各テスト後に React Testing Library の DOM をクリーンアップする。
afterEach(() => {
  cleanup();
});
