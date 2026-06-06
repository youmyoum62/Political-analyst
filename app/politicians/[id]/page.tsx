import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { RadarChart } from '@/components/RadarChart';
import { ScoreAxisLegend } from '@/components/ScoreAxisLegend';
import { ScoreHistoryChart } from '@/components/ScoreHistoryChart';
import { ScoreWeightsCard } from '@/components/ScoreWeightsCard';
import { ShareCard } from '@/components/ShareCard';
import {
  ApiActivityItem,
  ApiPoliticianDetail,
  detailToPolitician,
  fetchActivities,
  fetchAnalysis,
  fetchPoliticianDetail,
  fetchScoreHistory,
} from '@/lib/api-client';

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
    return <p className="mt-2 text-sm text-indigo-100">{detail.top_question}</p>;
  }

  const questionActivity = activities.find((a) => a.activity_type === 'question');
  if (questionActivity?.content_text) {
    const preview = questionActivity.content_text.slice(0, 150);
    const truncated = questionActivity.content_text.length > 150 ? `${preview}…` : preview;
    return (
      <p className="mt-2 text-sm text-indigo-100">
        {truncated}
        {questionActivity.source_url && (
          <>
            {' '}
            <a
              href={questionActivity.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-indigo-300 hover:text-indigo-100"
            >
              出典
            </a>
          </>
        )}
      </p>
    );
  }

  return (
    <p className="mt-2 text-sm text-slate-400">発言記録がまだ登録されていません</p>
  );
}

function KeyAchievementSection({
  detail,
  activities,
}: {
  detail: ApiPoliticianDetail;
  activities: ApiActivityItem[];
}) {
  if (detail.key_achievement) {
    return <p className="mt-2 text-sm text-emerald-100">{detail.key_achievement}</p>;
  }

  const achievementActivity = activities.find(
    (a) => a.activity_type === 'speech' || a.activity_type === 'committee_action'
  );
  if (achievementActivity?.content_text) {
    const preview = achievementActivity.content_text.slice(0, 100);
    const truncated =
      achievementActivity.content_text.length > 100 ? `${preview}…` : preview;
    return <p className="mt-2 text-sm text-emerald-100">{truncated}</p>;
  }

  return (
    <p className="mt-2 text-sm text-slate-400">
      立法・政策への関与記録はまだ登録されていません
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
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary', title, description },
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

  // データ未収集の評価軸（暫定スコアの透明性のため明示する）
  const uncollectedAxes: string[] = [];
  if (detail.legislative_score === 0) uncollectedAxes.push('立法実績');
  if (detail.policy_impact_score === 0) uncollectedAxes.push('政策実現');
  if (detail.influence_score === 0) uncollectedAxes.push('影響力');
  if (detail.quality_score === 50) uncollectedAxes.push('発言品質（AI評価）');

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm font-semibold text-cyan-300 hover:underline">
        ← ランキングに戻る
      </Link>

      {/* ── ヒーローセクション ── */}
      <section className="rounded-3xl border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-500/20 via-slate-900 to-cyan-500/10 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-200">スポットライトプロフィール</p>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">{detail.name}</h1>
        <p className="mt-1 text-slate-200">
          {detail.party}
          {' · '}
          {detail.house === 'representatives' ? '衆議院' : '参議院'}
          {detail.district ? ` · ${detail.district}` : ''}
          {detail.age ? ` · ${detail.age}歳` : ''}
        </p>
        <p className="mt-4 text-6xl font-black text-cyan-300">{detail.final_score.toFixed(1)}</p>
        <div className="mt-1 flex items-center gap-3 text-sm font-semibold text-slate-200">
          <span>暫定順位 #{rank}</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-bold tracking-wide">
            {ROLE_LABELS[detail.role_profile] ?? detail.role_profile}
          </span>
        </div>

        {uncollectedAxes.length > 0 && (
          <p className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
            ⚠ <strong>暫定スコア</strong>：このスコアは出席・発言データを中心に算出した暫定値です。
            次の評価軸はデータ収集中で未反映です — {uncollectedAxes.join('・')}。
          </p>
        )}
      </section>

      {/* ── メインコンテンツ ── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xl font-black">パワーレーダー</h2>
          <RadarChart metrics={politician.metrics} />
          <p className="mt-2 text-sm text-slate-300">5つの評価軸を一目で確認。</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="text-lg font-black">このスコアが示すもの</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{summaryText}</p>
            {!hasRealSummary && (
              <p className="mt-2 text-xs text-slate-500">
                ※ AIによる評価プロフィールは生成待ちです。上記はスコアから自動表示した暫定説明であり、AI生成文ではありません。
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4">
            <h3 className="text-lg font-black">注目質問</h3>
            <TopQuestionSection detail={detail} activities={activities} />
          </div>

          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
            <h3 className="text-lg font-black">主な実績</h3>
            <KeyAchievementSection detail={detail} activities={activities} />
          </div>
        </div>
      </section>

      {/* ── スコア内訳カード（analysisがある場合のみ表示） ── */}
      {analysis && <ScoreWeightsCard analysis={analysis} />}
      <ScoreAxisLegend />

      {/* ── スコア推移チャート ── */}
      <section>
        <h2 className="mb-2 text-xl font-black">スコア推移</h2>
        <ScoreHistoryChart history={history} />
      </section>

      {/* ── シェアセクション ── */}
      <section className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">
        話題になろう：この順位に同意する？このカードをシェアして、異論を持つ人に挑戦しよう。
      </section>

      <ShareCard politician={politician} rank={rank} />
    </div>
  );
}
