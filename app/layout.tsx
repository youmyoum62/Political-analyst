import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '政治スコアメディア',
  description: 'リアルタイム政治ランキング・対決比較・シェアカード'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
