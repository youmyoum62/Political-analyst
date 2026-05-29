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

function generateSummary(detail: ApiPoliticianDetail): string {
  const profile =
    (
      {
        opposition: '野党議員',
        ruling: '与党議員',
        cabinet: '閣僚・政務官',
        parliamentary: '院内役職者',
      } as Record<string, string>
    )[detail.role_profile] ?? detail.role_profile;

  const scores = [
    { label: '議会参加', v: detail.participation_score },
    { label: '発言品質', v: detail.quality_score },
    { label: '立法実績', v: detail.legislative_score },
    { label: '政策実現', v: detail.policy_impact_score },
    { label: '影響力', v: detail.influence_score },
  ];
  const top = [...scores].sort((a, b) => b.v - a.v).slice(0, 2);
  const topStr = top.map((s) => `${s.label}（${s.v.toFixed(1)}点）`).join('・');

  return `${profile}として、${topStr}が特に高評価。総合スコア${detail.final_score.toFixed(1)}点は、AIによる客観的な国会活動評価の結果です。`;
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

  const summaryText = detail.summary || generateSummary(detail);

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
          <span>現在の順位 #{rank}</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-bold uppercase tracking-widest">
            {detail.role_profile}
          </span>
        </div>
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
