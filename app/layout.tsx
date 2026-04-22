import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Political Score Media',
  description: 'Live political rankings, battle comparisons, and social share cards'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
