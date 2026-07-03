import { ImageResponse } from 'next/og';

import { loadNotoSansJP } from '@/lib/og-font';
import { SITE_NAME } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = SITE_NAME;

const CANVAS = '#17181a';
const INK = '#f1efe9';
const MUTED = '#9a988f';
const ACCENT = '#6ea8ff';

const TAGLINE = '国会議員の活動を公開データで可視化';
const SUB = '議会参加・発言品質・立法実績・政策実現・影響力を5つの軸で';

export default async function Image() {
  const fontData = await loadNotoSansJP(`${SITE_NAME}${TAGLINE}${SUB}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: CANVAS,
          padding: '72px',
          fontFamily: 'Noto Sans JP',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 6, color: ACCENT }}>
          {SITE_NAME}
        </div>
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 700, color: INK, marginTop: 20 }}>
          {TAGLINE}
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: MUTED, marginTop: 20 }}>{SUB}</div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: 'Noto Sans JP', data: fontData, weight: 700 as const, style: 'normal' as const }]
        : [],
    },
  );
}
