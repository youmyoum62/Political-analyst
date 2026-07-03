import './globals.css';
import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: { card: 'summary', title: SITE_NAME, description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={notoSansJP.variable}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-bold focus:text-canvas"
        >
          メインコンテンツへスキップ
        </a>
        <main id="main-content" className="mx-auto min-h-screen max-w-7xl px-6 py-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
