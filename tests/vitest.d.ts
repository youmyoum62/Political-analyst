import 'vitest';

// jest-axe の toHaveNoViolations を vitest の expect 型に追加する
// （@types/jest-axe は jest の型しか拡張しないため、ここで vitest 用に宣言する）。
interface AxeMatchers<R = unknown> {
  toHaveNoViolations(): R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = unknown> extends AxeMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
