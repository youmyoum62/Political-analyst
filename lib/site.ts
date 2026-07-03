// サイト共通設定。レイアウトのメタデータと信頼性ページ（about/methodology/privacy/disclaimer）で共有する。

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://political-analyst-s7s6.vercel.app'
).replace(/\/+$/, '');

export const SITE_NAME = '政治スコアメディア';

export const SITE_DESCRIPTION =
  '国会議員の議会参加・発言品質・立法実績・政策実現・影響力を公開データから可視化する暫定スコア。ランキング・対決比較・シェアカード。';

// 運営者情報。
// 表示名は屋号・サイト名義で公開（ユーザー選択）。別の屋号にしたい場合はここを変更する。
export const SITE_OPERATOR = '政治スコアメディア編集部';
// 公開用の問い合わせメールアドレス（屋号名義・中立運営のためロールアドレス）。
export const SITE_CONTACT_EMAIL = 'seijiscore.media@outlook.jp';

// 寄付導線。
// TODO(運営者): OFUSE / Ko-fi 等でアカウントを作成し、その公開URLをここに設定すると
// フッターと /about に「運営を支援する」リンクが表示される。未設定時は非表示。
// スコア表示領域には出さない（中立性の見た目を守るため）。
export const SITE_DONATE_URL = '';

export const CONTENT_UPDATED = '2026年7月3日';
