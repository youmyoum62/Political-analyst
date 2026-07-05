import type { Metadata } from 'next';
import Link from 'next/link';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED } from '@/lib/site';

export const metadata: Metadata = {
  title: 'スコアの読み方',
  description:
    '国会議員の活動スコアがどう作られているかの解説。議会参加・発言品質・立法実績・政策実現・影響力の5軸が何を測るか、役割別ウェイト、暫定値の意味、データ出典をやさしく説明します。',
};

export default function HowScoresWorkPage() {
  return (
    <ContentPage
      title="スコアの読み方"
      lead="5つの評価軸が何を測っているか、役割によってウェイトが変わる理由、そして「暫定値」であることの意味を解説します。"
      updated={CONTENT_UPDATED}
    >
      <ContentSection heading="スコアは「活動の量と質」を可視化する試み">
        <p>
          当サイトのスコアは、国会議員の日々の活動を公開データから定量化し、比較しやすくするための
          指標です。人気投票や支持率ではなく、会議録・議案データベース・委員会名簿といった一次情報に
          もとづいて算出しています。政治家の「良し悪し」を断定するものではなく、活動の傾向を読み解く
          ための出発点としてご利用ください。
        </p>
      </ContentSection>

      <ContentSection heading="5つの評価軸">
        <p>総合スコアは、次の5つの軸をそれぞれ0〜100点で正規化し、加重平均して算出します。</p>
        <ul className="space-y-3">
          <li>
            <span className="font-bold text-ink">議会参加</span> ―
            本会議・委員会での質問や発言の量。議員がどれだけ議論に加わっているかを測ります。
            （後述のとおり、個人別の出席率は公開データが存在しないため、発言・質問の件数で代替しています。）
          </li>
          <li>
            <span className="font-bold text-ink">発言品質</span> ―
            質問・答弁の内容をAIが評価したスコア。具体性・論拠・政策的な深さなどを0〜100で採点します。
            発言が一定数に満たない議員は、中立値として扱われます。
          </li>
          <li>
            <span className="font-bold text-ink">立法実績</span> ―
            法案の提出・共同提出・委員会での審議関与など、立法プロセスへの貢献の量。
          </li>
          <li>
            <span className="font-bold text-ink">政策実現</span> ―
            提出した法案がどれだけ成立に至ったか、その影響度。プロセス（立法実績）ではなく結果を見ます。
          </li>
          <li>
            <span className="font-bold text-ink">影響力</span> ―
            委員長・理事・党や議会の役職など、制度上のポジションの重み。多数派・当選回数に紐づく
            権力の実測であり、新人や少数会派が低く出るのは軸の性質どおりです。
          </li>
        </ul>
      </ContentSection>

      <ContentSection heading="役割によってウェイトが変わる">
        <p>
          議員の役割によって主戦場が違うため、役割ごとに5軸のウェイトを変えています。たとえば野党議員は
          質問・発言を通じた監視が主業務なので発言品質を重く、閣僚は法案を束ねる立場なので立法実績・政策
          実現を重く見ます。議会の役職者（委員長など）は中立的な議事運営が役割なので、制度的な影響力を
          重視します。これにより「与党だから高い／野党だから低い」といった一律のバイアスを避けています。
        </p>
      </ContentSection>

      <ContentSection heading="「暫定値」であることの意味">
        <p>
          スコアは公開データが更新されるたびに再計算される暫定値です。会議録の反映には数日〜2週間の遅れが
          あり、また評価軸によってはデータが揃っていない議員もいます。したがって、ある時点のスコアや順位は
          「現時点で観測できる範囲での傾向」であり、確定した評価ではありません。順位が近い議員どうしの差は
          誤差の範囲と考えるのが妥当です。
        </p>
        <p>
          とくに発言品質は、有効な評価が一定数に満たない議員を中立値として扱うため、答弁の少ない時期の
          議員などは「低評価」ではなく「未評価に近い」状態である点にご注意ください。
        </p>
      </ContentSection>

      <ContentSection heading="データの出典">
        <p>
          スコアは、国会会議録検索システム（発言・質問）、国会議案データベース（法案。スマートニュース
          メディア研究所提供・MIT License）、衆議院・参議院の公式サイト（委員会名簿・役職）にもとづいて
          います。各データの取り扱いと算出式の詳細は
          {' '}
          <Link href="/methodology" className="text-accent hover:underline">評価方法</Link>
          {' '}
          のページに、当サイトの独立性やAIの使い方は
          {' '}
          <Link href="/editorial-policy" className="text-accent hover:underline">データ・編集方針</Link>
          {' '}
          にまとめています。
        </p>
      </ContentSection>
    </ContentPage>
  );
}
