import { ImageResponse } from 'next/og';

import { fetchPoliticianDetail } from '@/lib/api-client';
import { loadNotoSansJP } from '@/lib/og-font';
import { SITE_NAME } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = '国会活動スコア';

const HOUSE_LABELS: Record<string, string> = {
  representatives: '衆議院',
  councillors: '参議院',
};

// デザイントークン（tailwind.config.ts と対応）
const CANVAS = '#17181a';
const SURFACE = '#1f2123';
const LINE = '#34373a';
const INK = '#f1efe9';
const MUTED = '#9a988f';
const ACCENT = '#6ea8ff';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await fetchPoliticianDetail(Number(id)).catch(() => null);

  const name = detail?.name ?? '議員が見つかりません';
  const party = detail?.party ?? '';
  const houseLabel = detail ? HOUSE_LABELS[detail.house] ?? detail.house : '';
  const score = detail ? detail.final_score.toFixed(1) : '—';
  const rank = detail?.rank ?? null;
  const sub = [party, houseLabel].filter(Boolean).join('・');

  const text =
    `${name}${sub}国会活動スコア暫定順位点暫定値${SITE_NAME}・#0123456789.—${score}${rank ?? ''}`;
  const fontData = await loadNotoSansJP(text);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: CANVAS,
          padding: '64px 72px',
          fontFamily: 'Noto Sans JP',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 28, letterSpacing: 6, color: ACCENT }}>
            国会活動スコア
          </div>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, color: INK, marginTop: 12 }}>
            {name}
          </div>
          {sub && (
            <div style={{ display: 'flex', fontSize: 32, color: MUTED, marginTop: 8 }}>{sub}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 200, fontWeight: 700, lineHeight: 1, color: ACCENT }}>
              {score}
            </div>
            <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 12 }}>
              {rank ? `暫定順位 #${rank} ・ 暫定値` : '暫定値'}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: MUTED,
              border: `1px solid ${LINE}`,
              backgroundColor: SURFACE,
              borderRadius: 12,
              padding: '10px 20px',
            }}
          >
            {SITE_NAME}
          </div>
        </div>
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
