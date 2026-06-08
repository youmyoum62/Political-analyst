import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// tsconfig の `@/*` -> `./*` エイリアスを vitest 解決でも再現する。
// `/^@\//` で正規表現マッチさせ、`@testing-library/*` 等の scoped package を誤って
// 巻き込まないようにする（文字列 '@' だと scoped package まで置換される罠を回避）。
const root = dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
  },
});
