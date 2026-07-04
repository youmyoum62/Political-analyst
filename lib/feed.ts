/**
 * 「国会の動き」RSS 2.0 フィード生成ロジック（純関数群）。
 * app/feed.xml/route.ts から呼び出す。XML エスケープ・item 生成をテスト可能にするため
 * ここに切り出す。
 */

import type { Digest } from '@/lib/api-client';

const ACTIVITY_LABELS: Record<string, string> = {
  question: '質問',
  speech: '発言',
  committee_action: '委員会',
};

const BILL_STATUS_LABELS: Record<string, string> = {
  submitted: '提出',
  in_committee: '委員会審議中',
  passed: '成立・可決',
  rejected: '否決',
  withdrawn: '撤回',
};

export type FeedItem = {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description: string;
};

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 'YYYY-MM-DD' 等の日付文字列を RFC 822 形式へ。不正な値は現在時刻にフォールバックする。 */
export function toRfc822(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

/**
 * Digest（トップページ「国会の動き」欄のデータ）を RSS item の配列へ変換する。
 * - 会議録は日単位（DietActivityFeed の表示粒度に合わせる）。link は代表として
 *   その日最初の発言者の source_url を使う。
 * - 法案は 1 件 1 item。link は bill.source_url、無ければサイトトップにフォールバック。
 */
export function digestToFeedItems(digest: Digest, siteUrl: string): FeedItem[] {
  const items: FeedItem[] = [];

  for (const day of digest.minutes) {
    const speakerText = day.speakers
      .map(
        (sp) =>
          `${sp.name}${sp.party ? `（${sp.party}）` : ''} - ${ACTIVITY_LABELS[sp.activity_type] ?? sp.activity_type}`,
      )
      .join('、');
    items.push({
      title: `新着会議録: ${day.date}（${day.speaker_count}件）`,
      link: day.speakers[0]?.source_url ?? siteUrl,
      guid: `${siteUrl}/feed.xml#minutes-${day.date}`,
      pubDate: toRfc822(day.date),
      description: speakerText || '新着の発言記録があります。',
    });
  }

  for (const bill of digest.bills) {
    const statusLabel = BILL_STATUS_LABELS[bill.status] ?? bill.status;
    items.push({
      title: `法案の動き: ${bill.title}（${statusLabel}）`,
      link: bill.source_url ?? siteUrl,
      guid: `${siteUrl}/feed.xml#bill-${bill.id}`,
      pubDate: toRfc822(bill.date ?? digest.generated_at),
      description: `${bill.title} が${statusLabel}になりました。`,
    });
  }

  return items;
}

export type RssChannel = {
  title: string;
  link: string;
  description: string;
  siteUrl: string;
  items: FeedItem[];
};

export function buildRssXml(channel: RssChannel): string {
  const { title, link, description, siteUrl, items } = channel;

  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <language>ja</language>
    <atom:link href="${escapeXml(`${siteUrl}/feed.xml`)}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>
`;
}
