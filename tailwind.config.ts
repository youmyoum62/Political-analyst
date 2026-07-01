import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ダーク基調のニュートラル背景・表面
        canvas: '#17181a',
        surface: '#1f2123',
        line: '#34373a',
        // テキスト
        ink: '#f1efe9',
        muted: '#9a988f',
        // 2アクセント（ブルー＝信頼／アンバー＝暖かみ）
        accent: '#6ea8ff',
        accent2: '#e3a857',
        // トレンド（上昇／下落）
        up: '#57cf8d',
        down: '#e08763'
      },
      fontFamily: {
        sans: ['var(--font-noto-sans-jp)', 'system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
