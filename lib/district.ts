// 選挙区文字列から都道府県を抽出するユーティリティ。
// 実データ（/v1/ranking の district）を調査して設計:
//   - 小選挙区/選挙区は「県名(短縮形)＋任意の番号」: 三重 / 京都6 / 大阪19（北海道のみフル形）
//   - 合区は「県名・県名」: 徳島・高知 / 鳥取・島根
//   - 比例代表は「比例」または「（比）近畿」等で、特定の都道府県に紐づかない → 空を返す

/** 都道府県の [value(dataの短縮形), label(表示名)]。value は district 文字列の接頭辞と一致する。 */
export const PREFECTURES: { value: string; label: string }[] = [
  { value: '北海道', label: '北海道' },
  { value: '青森', label: '青森県' },
  { value: '岩手', label: '岩手県' },
  { value: '宮城', label: '宮城県' },
  { value: '秋田', label: '秋田県' },
  { value: '山形', label: '山形県' },
  { value: '福島', label: '福島県' },
  { value: '茨城', label: '茨城県' },
  { value: '栃木', label: '栃木県' },
  { value: '群馬', label: '群馬県' },
  { value: '埼玉', label: '埼玉県' },
  { value: '千葉', label: '千葉県' },
  { value: '東京', label: '東京都' },
  { value: '神奈川', label: '神奈川県' },
  { value: '新潟', label: '新潟県' },
  { value: '富山', label: '富山県' },
  { value: '石川', label: '石川県' },
  { value: '福井', label: '福井県' },
  { value: '山梨', label: '山梨県' },
  { value: '長野', label: '長野県' },
  { value: '岐阜', label: '岐阜県' },
  { value: '静岡', label: '静岡県' },
  { value: '愛知', label: '愛知県' },
  { value: '三重', label: '三重県' },
  { value: '滋賀', label: '滋賀県' },
  { value: '京都', label: '京都府' },
  { value: '大阪', label: '大阪府' },
  { value: '兵庫', label: '兵庫県' },
  { value: '奈良', label: '奈良県' },
  { value: '和歌山', label: '和歌山県' },
  { value: '鳥取', label: '鳥取県' },
  { value: '島根', label: '島根県' },
  { value: '岡山', label: '岡山県' },
  { value: '広島', label: '広島県' },
  { value: '山口', label: '山口県' },
  { value: '徳島', label: '徳島県' },
  { value: '香川', label: '香川県' },
  { value: '愛媛', label: '愛媛県' },
  { value: '高知', label: '高知県' },
  { value: '福岡', label: '福岡県' },
  { value: '佐賀', label: '佐賀県' },
  { value: '長崎', label: '長崎県' },
  { value: '熊本', label: '熊本県' },
  { value: '大分', label: '大分県' },
  { value: '宮崎', label: '宮崎県' },
  { value: '鹿児島', label: '鹿児島県' },
  { value: '沖縄', label: '沖縄県' },
];

const PREFECTURE_SET = new Set(PREFECTURES.map((p) => p.value));

/**
 * 選挙区文字列から該当する都道府県（短縮形）を返す。
 * 合区は複数返す。比例代表・空・未知は空配列。
 */
export function extractPrefectures(district: string | null | undefined): string[] {
  if (!district) return [];
  const d = district.trim();
  if (d === '' || d.startsWith('比例') || d.startsWith('（比）')) return [];

  const result = new Set<string>();
  for (const part of d.split('・')) {
    const base = part.replace(/\d+$/, ''); // 末尾の選挙区番号を除去
    if (PREFECTURE_SET.has(base)) result.add(base);
  }
  return [...result];
}
