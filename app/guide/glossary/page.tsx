import type { Metadata } from 'next';
import Link from 'next/link';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED } from '@/lib/site';

export const metadata: Metadata = {
  title: '国会用語集',
  description:
    '会派・委員会・本会議・質問主意書・共同提出・閣法と議員立法など、国会報道でよく目にする用語を短くまとめました。',
};

type Term = { term: string; body: string };

const HOUSE_TERMS: Term[] = [
  {
    term: '会派',
    body:
      '国会内で活動をともにする議員のグループのことです。多くの場合は同じ政党の議員で構成されますが、複数の政党・無所属議員が一つの会派を組むこともあります。質問時間の配分や委員会の委員数は、所属議員数ではなく会派の人数を基準に決まります。',
  },
  {
    term: '常任委員会・特別委員会',
    body:
      '本会議での審議に先立ち、法案や予算を分野ごとに詳しく検討する場です。予算委員会・厚生労働委員会など、常に設置されている「常任委員会」と、特定の課題ごとに一時的に設けられる「特別委員会」があります。実質的な質疑・議論の多くはここで行われます。',
  },
  {
    term: '本会議',
    body:
      '衆議院・参議院それぞれの全議員が出席して行う会議です。委員会での審議・採決を経た法案の最終的な可決・否決や、内閣総理大臣の指名などが本会議で決められます。',
  },
  {
    term: '与党・野党',
    body:
      '内閣を組織し政権を担当する政党（または政党の連合）を「与党」、それ以外の政党を「野党」と呼びます。与党は法案の提出・成立を、野党は質疑や追及を通じた監視を主な役割とすることが多く、当サイトのスコアでも役割ごとに評価軸の重みを変えている理由の一つです。',
  },
  {
    term: '党議拘束',
    body:
      '本会議・委員会での採決の際、所属政党の方針に沿って賛否をそろえるよう求める党内の取り決めです。法的な義務ではなく政党ごとの運用ですが、多くの法案で党議拘束がかかるため、採決結果が会派単位でまとまる傾向があります。',
  },
];

const DELIBERATION_TERMS: Term[] = [
  {
    term: '質疑',
    body:
      '委員会や本会議で、議員が法案の提出者や大臣に対して内容を問いただすことです。答弁とあわせて会議録に記録され、当サイトの発言関連スコアの元データにもなっています。',
  },
  {
    term: '採決',
    body:
      '委員会や本会議で、法案などへの賛成・反対を決める手続きです。起立・挙手・記名投票・押しボタン式の電子投票など、院や案件によって方法が異なります。',
  },
  {
    term: '継続審査',
    body:
      '会期中に結論の出なかった案件について、委員会の議決により閉会中も審査を続けられるようにする手続きです。これを行わない場合、案件は原則として会期末に廃案となります（会期不継続の原則）。',
  },
  {
    term: '両院協議会',
    body:
      '衆議院と参議院で法案などの議決が異なった場合に、両院から選ばれた委員が意見の調整を試みる会議です。予算・条約・内閣総理大臣の指名では必ず開かれ、法律案では任意で開くことができます。',
  },
  {
    term: '質問主意書',
    body:
      '国会議員が、国会の会期中に文書で内閣に質問をぶつける制度です。内閣は原則として7日以内に文書で答弁する義務があり、口頭質問とは別に、個々の議員が政府の見解を公式に記録として残す手段として使われます。',
  },
];

const BILL_TERMS: Term[] = [
  {
    term: '閣法（内閣提出法律案）',
    body:
      '内閣が国会に提出する法律案です。各省庁が原案を作成し、内閣として閣議決定したうえで提出するため、議員立法に比べて成立率が高い傾向があります。',
  },
  {
    term: '議員立法（議員提出法律案）',
    body:
      '国会議員が自ら発議して提出する法律案です。提出には一定数以上の賛成議員（衆議院20人以上・参議院10人以上、予算を伴う場合はさらに多い人数）が必要です。',
  },
  {
    term: '共同提出',
    body:
      '一つの法律案を複数の議員が連名で提出することです。中心となって発議する議員のほか、賛同して名を連ねる議員も含まれ、当サイトの立法実績スコアでは両者を法案への関与として数えています。',
  },
  {
    term: '発議',
    body:
      '議員が法律案や決議案などを国会に提案する行為そのものを指す言葉です。「議員立法を発議する」のように使われます。',
  },
];

function TermList({ terms }: { terms: Term[] }) {
  return (
    <dl className="space-y-4">
      {terms.map((t) => (
        <div key={t.term} className="rounded-lg border border-line bg-surface p-4">
          <dt className="font-bold text-ink">{t.term}</dt>
          <dd className="mt-1.5">{t.body}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function GlossaryPage() {
  return (
    <ContentPage
      title="国会用語集"
      lead="国会報道や当サイトのページでよく目にする用語を、短くまとめました。"
      updated={CONTENT_UPDATED}
    >
      <ContentSection heading="会派・院内のしくみ">
        <TermList terms={HOUSE_TERMS} />
      </ContentSection>

      <ContentSection heading="審議・議決に関する言葉">
        <TermList terms={DELIBERATION_TERMS} />
      </ContentSection>

      <ContentSection heading="法案に関する言葉">
        <TermList terms={BILL_TERMS} />
      </ContentSection>

      <ContentSection heading="あわせて読みたい">
        <p>
          法案が成立するまでの一連の流れは
          {' '}
          <Link href="/guide/how-a-bill-becomes-law" className="text-accent hover:underline">法案が成立するまで</Link>
          {' '}
          で、これらの用語がスコアにどう関係するかは
          {' '}
          <Link href="/guide/how-scores-work" className="text-accent hover:underline">スコアの読み方</Link>
          {' '}
          で解説しています。
        </p>
      </ContentSection>
    </ContentPage>
  );
}
