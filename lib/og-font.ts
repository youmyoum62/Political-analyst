/**
 * OGP画像（next/og の ImageResponse = satori）用に Noto Sans JP のサブセットを取得する。
 * satori は woff2 を扱えないため TTF/OTF が必要。Google Fonts の css2 エンドポイントは、
 * ブラウザ以外の UA には TTF を返すため、その URL を抜き出して取得する。
 * text に含まれる文字だけをサブセット取得するので軽量・高速。
 * 取得失敗時は null を返し、呼び出し側でフォントなし（英数字のみ）にフォールバックする。
 */
export async function loadNotoSansJP(text: string): Promise<ArrayBuffer | null> {
  try {
    const url =
      'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700' +
      `&text=${encodeURIComponent(text)}`;
    const cssRes = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1], { signal: AbortSignal.timeout(8_000) });
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}
