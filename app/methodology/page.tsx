import type { Metadata } from 'next';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED } from '@/lib/site';

export const metadata: Metadata = {
  title: '評価方法',
  description:
    '当サイトが国会議員の活動スコアを算出する方法。5つの評価軸、役割プロファイル別のウェイト、データ出典、暫定値である理由を説明します。',
};

const AXES: { label: string; description: string }[] = [
  { label: '議会参加', description: '質問数・発言数・委員会出席数など、議会活動への積極性を定量化します。' },
  { label: '発言品質', description: 'AIが評価した質問・発言の具体性・政策的深度・論拠の質です（評価は順次反映）。' },
  { label: '立法実績', description: '法案の提出数・共同提案数・委員会での審議関与度です。' },
  { label: '政策実現', description: '提出した法案の可決率・成立した法案の影響度です。' },
  { label: '影響力', description: '委員長・理事・党役職などの院内での制度的ポジションに基づく政治的影響力です。' },
];

// backend/app/scoring/calculator.py の ROLE_WEIGHTS と一致させること。
const WEIGHTS: { profile: string; note: string; w: [number, number, number, number, number] }[] = [
  { profile: '野党一般', note: '質問・追及が主業務', w: [20, 35, 20, 15, 10] },
  { profile: '与党一般', note: '立法・政策推進が主業務', w: [15, 25, 25, 20, 15] },
  { profile: '閣僚', note: '法案成立・政策執行が主業務', w: [10, 20, 30, 25, 15] },
  { profile: '議会役職', note: '議事運営・中立が主業務', w: [15, 15, 20, 20, 30] },
];

const AXIS_HEADERS = ['議会参加', '発言品質', '立法実績', '政策実現', '影響力'];

export default function MethodologyPage() {
  return (
    <ContentPage
      title="評価方法"
      lead="スコアがどのように算出されているかを公開します。"
      updated={CONTENT_UPDATED}
    >
      <ContentSection heading="スコアの位置づけ（重要）">
        <p>
          当サイトのスコアは、公開データを基に当サイトが独自に算出した
          <strong className="text-ink">暫定値</strong>です。政治家個人への評価・支持・不支持を
          示すものではなく、確定的なランキングでもありません。特に立法実績・政策実現・影響力・
          発言品質（AI評価）はデータ収集・評価が進行中で、多くの議員でまだ十分に反映されていません。
        </p>
      </ContentSection>

      <ContentSection heading="5つの評価軸">
        <ul className="space-y-2.5">
          {AXES.map((axis) => (
            <li key={axis.label} className="flex items-start gap-2.5">
              <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span>
                <span className="font-semibold text-ink">{axis.label}</span>
                <span className="ml-1">— {axis.description}</span>
              </span>
            </li>
          ))}
        </ul>
        <p>各軸は0〜100点で正規化し、総合スコアは軸ごとのウェイトを掛けた加重平均です。</p>
      </ContentSection>

      <ContentSection heading="役割プロファイル別のウェイト">
        <p>
          議員の役割によって主業務が異なるため、役割プロファイルごとに軸のウェイトを変えています
          （単位: %）。例えば野党議員は質問・追及が主業務のため発言品質を重視し、議会役職者は
          議事運営が主業務のため影響力を重視します。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pr-3 text-left font-semibold">役割プロファイル</th>
                {AXIS_HEADERS.map((h) => (
                  <th key={h} className="px-2 py-2 text-right font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEIGHTS.map((row) => (
                <tr key={row.profile} className="border-b border-line/60">
                  <td className="py-2 pr-3">
                    <span className="font-semibold text-ink">{row.profile}</span>
                    <span className="ml-1 text-muted">（{row.note}）</span>
                  </td>
                  {row.w.map((v, i) => (
                    <td key={i} className="px-2 py-2 text-right tabular-nums text-ink">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentSection>

      <ContentSection heading="影響力軸の考え方">
        <p>
          影響力は「制度的ポジション（委員長・理事・党役職など、多数派や当選回数に紐づく院内の
          権限）」の実測値として算出し、院や会派をまたいだ相対化は行いません。新人や少数会派の
          議員が低くなるのは、影響力軸としては正確な反映であり不具合ではありません。
        </p>
      </ContentSection>

      <ContentSection heading="データ出典">
        <ul className="space-y-2">
          <li>
            <span className="font-semibold text-ink">発言・会議データ：</span>
            国立国会図書館「国会会議録検索システム」API
          </li>
          <li>
            <span className="font-semibold text-ink">法案・議案データ：</span>
            スマートニュース メディア研究所「国会議案データベース」（MIT License）。
            一次情報は衆議院・参議院 公式「議案情報」
          </li>
          <li>
            <span className="font-semibold text-ink">役職・委員会名簿：</span>
            衆議院・参議院 公式サイト（委員会名簿）
          </li>
        </ul>
        <p>
          スコアは各データ提供元の見解を示すものではありません。データは定期的に更新しており、
          収集の進捗に応じてスコア・順位が変動します。
        </p>
      </ContentSection>
    </ContentPage>
  );
}
