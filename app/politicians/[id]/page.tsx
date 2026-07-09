import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CareerRoles } from '@/components/CareerRoles';
import { LegislativeActivity } from '@/components/LegislativeActivity';
import { RadarChartLazy } from '@/components/RadarChartLazy';
import { ScoreAxisLegend } from '@/components/ScoreAxisLegend';
import { ScoreHistoryChartLazy } from '@/components/ScoreHistoryChartLazy';
import { ScoreWeightsCard } from '@/components/ScoreWeightsCard';
import { ShareCard } from '@/components/ShareCard';
import { SpeechHighlights } from '@/components/SpeechHighlights';
import {
  ApiActivityItem,
  ApiPoliticianDetail,
  detailToPolitician,
  fetchActivities,
  fetchAnalysis,
  fetchPoliticianDetail,
  fetchScoreHistory,
} from '@/lib/api-client';
import { SITE_URL } from '@/lib/site';

const ROLE_LABELS: Record<string, string> = {
  opposition: '野党議員',
  ruling: '与党議員',
  cabinet: '閣僚・政務官',
  parliamentary: '院内役職者',
};

function generateSummary(detail: ApiPoliticianDetail): string {
  const profile = ROLE_LABELS[detail.role_profile] ?? detail.role_profile;

  const scores = [
    { label: '議会参加', v: detail.participation_score },
    { label: '発言品質', v: detail.quality_score },
    { label: '立法実績', v: detail.legislative_score },
    { label: '政策実現', v: detail.policy_impact_score },
    { label: '影響力', v: detail.influence_score },
  ];
  const top = [...scores].sort((a, b) => b.v - a.v).slice(0, 2);
  const topStr = top.map((s) => `${s.label}（${s.v.toFixed(1)}点）`).join('・');

  return `${profile}として、${topStr}が相対的に高めです。総合スコア${detail.final_score.toFixed(1)}点は、出席・発言データを中心に算出した暫定評価です。`;
}

function TopQuestionSection({
  detail,
  activities,
}: {
  detail: ApiPoliticianDetail;
  activities: ApiActivityItem[];
}) {
  if (detail.top_question) {
    return <p className="mt-2 text-sm text-ink">{detail.top_question}</p>;
  }

  const questionActivity = activities.find((a) => a.activity_type === 'question');
  if (questionActivity?.content_text) {
    const preview = questionActivity.content_text.slice(0, 150);
    const truncated = questionActivity.content_text.length > 150 ? `${preview}…` : preview;
    return (
      <p className="mt-2 text-sm text-ink">
        {truncated}
        {questionActivity.source_url && (
          <>
            {' '}
            <a
              href={questionActivity.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-accent hover:text-ink"
            >
              出典
            </a>
          </>
        )}
      </p>
    );
  }

  return (
    <p className="mt-2 text-sm text-muted">発言記録がまだ登録されていません</p>
  );
}

function KeyAchievementSection({
  detail,
  activities,
}: {
  detail: ApiPoliticianDetail;
  activities: ApiActivityItem[];
}) {
  // 立法・政策の実データが皆無なら、AI生成の実績要約は根拠を欠くため表示しない
  // （裏付けのない「実績」の提示を避ける）。
  const hasLegislativeEvidence =
    detail.legislative_score > 0 || detail.policy_impact_score > 0;

  if (detail.key_achievement && hasLegislativeEvidence) {
    return (
      <>
        <p className="mt-2 text-sm text-ink">{detail.key_achievement}</p>
        <p className="mt-1 text-xs text-muted">※ この実績要約はAIが公開データを基に生成したものです。</p>
      </>
    );
  }

  const achievementActivity = activities.find(
    (a) => a.activity_type === 'speech' || a.activity_type === 'committee_action'
  );
  if (achievementActivity?.content_text) {
    const preview = achievementActivity.content_text.slice(0, 100);
    const truncated =
      achievementActivity.content_text.length > 100 ? `${preview}…` : preview;
    return <p className="mt-2 text-sm text-ink">{truncated}</p>;
  }

  return (
    <p className="mt-2 text-sm text-muted">
      立法・政策の実績データはまだ十分に収集されていません
    </p>
  );
}

// ISR: 動的セグメントのためビルド時 prerender されず、初回アクセスで描画し
// 300秒キャッシュする（API のビルド時依存を生まない安全な設定）。
export const revalidate = 300;

const HOUSE_LABELS: Record<string, string> = {
  representatives: '衆議院',
  councillors: '参議院',
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const detail = await fetchPoliticianDetail(Number(id));
  if (!detail) {
    return { title: '議員が見つかりません' };
  }
  const houseLabel = HOUSE_LABELS[detail.house] ?? detail.house;
  const title = `${detail.name}（${detail.party}・${houseLabel}）の国会活動スコア`;
  const description = (
    detail.summary ||
    `${detail.name}（${detail.party}・${houseLabel}）の議会参加・発言品質・立法実績・政策実現・影響力を可視化した暫定スコア（総合${detail.final_score.toFixed(1)}点）。`
  ).slice(0, 120);
  return {
    title,
    description,
    alternates: { canonical: `/politicians/${id}` },
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PoliticianPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const politicianId = Number(id);

  const detail = await fetchPoliticianDetail(politicianId);
  if (!detail) notFound();

  const [analysis, history, activities] = await Promise.all([
    fetchAnalysis(politicianId),
    fetchScoreHistory(politicianId),
    fetchActivities(politicianId, { limit: 3, type: 'question' }),
  ]);

  const politician = detailToPolitician(detail);
  const rank = detail.rank ?? 1;

  const hasRealSummary = Boolean(detail.summary);
  const summaryText = detail.summary || generateSummary(detail);

  const canonical = `${SITE_URL}/politicians/${politicianId}`;
  const houseLabel = HOUSE_LABELS[detail.house] ?? detail.house;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        name: detail.name,
        jobTitle: '国会議員',
        affiliation: { '@type': 'Organization', name: detail.party },
        memberOf: { '@type': 'Organization', name: houseLabel },
        url: canonical,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'トップ', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '全議員ランキング', item: `${SITE_URL}/ranking` },
          { '@type': 'ListItem', position: 3, name: detail.name, item: canonical },
        ],
      },
    ],
  };

  // データ未収集の評価軸（暫定スコアの透明性のため明示する）
  const uncollectedAxes: string[] = [];
  if (detail.legislative_score === 0) uncollectedAxes.push('立法実績');
  if (detail.policy_impact_score === 0) uncollectedAxes.push('政策実現');
  if (detail.influence_score === 0) uncollectedAxes.push('影響力');
  if (detail.quality_score === 50) uncollectedAxes.push('発言品質（AI評価）');

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link href="/" className="text-sm font-semibold text-accent hover:underline">
        ← ランキングに戻る
      </Link>

      {/* ── ヒーローセクション ── */}
      <section className="rounded-3xl border border-line bg-surface p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">議員プロフィール</p>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">{detail.name}</h1>
        <p className="mt-1 text-muted">
          {detail.party}
          {' · '}
          {detail.house === 'representatives' ? '衆議院' : '参議院'}
          {detail.district ? ` · ${detail.district}` : ''}
          {detail.age ? ` · ${detail.age}歳` : ''}
        </p>
        <p className="mt-4 text-6xl font-black text-accent">{detail.final_score.toFixed(1)}</p>
        <div className="mt-1 flex items-center gap-3 text-sm font-semibold">
          <span className="text-muted">暫定順位 #{rank}</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs font-bold text-ink">
            {ROLE_LABELS[detail.role_profile] ?? detail.role_profile}
          </span>
        </div>

        {uncollectedAxes.length > 0 && (
          <div className="mt-4 flex gap-2.5 rounded-xl border border-line bg-canvas p-3">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent2 text-[10px] font-bold text-accent2">i</span>
            <p className="text-xs leading-relaxed text-muted">
              <strong className="text-ink">暫定スコア。</strong>このスコアは出席・発言データを中心に算出した暫定値です。
              次の評価軸はデータ収集中で未反映です — {uncollectedAxes.join('・')}。
            </p>
          </div>
        )}
      </section>

      {/* ── メインコンテンツ ── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xl font-black">パワーレーダー</h2>
          <RadarChartLazy metrics={politician.metrics} />
          <p className="mt-2 text-sm text-muted">5つの評価軸を一目で確認。</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="text-lg font-black">このスコアが示すもの</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{summaryText}</p>
            {!hasRealSummary && (
              <p className="mt-2 text-xs text-muted">
                ※ AIによる評価プロフィールは生成待ちです。上記はスコアから自動表示した暫定説明であり、AI生成文ではありません。
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="text-xs font-black uppercase tracking-[0.06em] text-accent">注目質問</h3>
            <TopQuestionSection detail={detail} activities={activities} />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="text-xs font-black uppercase tracking-[0.06em] text-accent2">主な実績</h3>
            <KeyAchievementSection detail={detail} activities={activities} />
          </div>
        </div>
      </section>

      {/* ── 活動ドシエ（一次情報＋AI論評）：データがある場合のみ各セクション表示 ── */}
      <SpeechHighlights speeches={detail.top_speeches ?? []} />
      <LegislativeActivity bills={detail.bills ?? []} />
      <CareerRoles roles={detail.roles ?? []} />

      {/* ── スコア内訳カード（analysisがある場合のみ表示） ── */}
      {analysis && <ScoreWeightsCard analysis={analysis} />}
      <ScoreAxisLegend />

      {/* ── スコア推移チャート ── */}
      <section>
        <h2 className="mb-2 text-xl font-black">スコア推移</h2>
        <ScoreHistoryChartLazy history={history} />
      </section>

      {/* ── シェアセクション ── */}
      <section className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        この順位に同意する？このカードを共有して、意見を交換しよう。
      </section>

      <ShareCard politician={politician} rank={rank} />
    </div>
  );
}
