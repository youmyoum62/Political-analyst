/**
 * 全ページ共通フッター。データ出典を明記する。
 *
 * 法案・議案データはスマートニュース メディア研究所「国会議案データベース」(MIT) に由来し、
 * MIT ライセンス上クレジット表記が必要なため、ここで出典とライセンスを明示する。
 */

import Link from 'next/link';

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '/about', label: 'このサイトについて' },
  { href: '/methodology', label: '評価方法' },
  { href: '/privacy', label: 'プライバシーポリシー' },
  { href: '/disclaimer', label: '免責事項' },
];

type Source = {
  label: string;
  detail: string;
  links: { text: string; href: string }[];
};

const SOURCES: Source[] = [
  {
    label: '発言・会議データ',
    detail: '国立国会図書館「国会会議録検索システム」API',
    links: [{ text: 'kokkai.ndl.go.jp', href: 'https://kokkai.ndl.go.jp/' }],
  },
  {
    label: '法案・議案データ',
    detail:
      'スマートニュース メディア研究所「国会議案データベース」（MIT License）。一次情報は衆議院・参議院 公式「議案情報」。',
    links: [
      {
        text: '衆議院データ',
        href: 'https://github.com/smartnews-smri/house-of-representatives',
      },
      {
        text: '参議院データ',
        href: 'https://github.com/smartnews-smri/house-of-councillors',
      },
    ],
  },
  {
    label: '役職・委員会名簿',
    detail: '衆議院・参議院 公式サイト（委員会名簿）',
    links: [
      { text: '衆議院', href: 'https://www.shugiin.go.jp/' },
      { text: '参議院', href: 'https://www.sangiin.go.jp/' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-12 max-w-7xl border-t border-line px-6 py-8 text-xs text-muted">
      <nav aria-label="サイト情報" className="mb-6 flex flex-wrap gap-x-5 gap-y-2">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="font-semibold text-ink hover:text-accent hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
      <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">
        データ出典
      </h2>
      <ul className="mt-3 space-y-3">
        {SOURCES.map((s) => (
          <li key={s.label}>
            <span className="font-semibold text-ink">{s.label}：</span>
            <span>{s.detail}</span>
            {s.links.length > 0 && (
              <span className="ml-1">
                （
                {s.links.map((l, i) => (
                  <span key={l.href}>
                    {i > 0 && '・'}
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline-offset-2 hover:underline"
                    >
                      {l.text}
                    </a>
                  </span>
                ))}
                ）
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-muted">
        スコアは公開データを基に当サイトが独自に算出した暫定値であり、各データ提供元の見解を示すものではありません。
        法案データの利用にあたり「スマートニュース メディア研究所」をデータ提供元として表示しています。
      </p>
    </footer>
  );
}
