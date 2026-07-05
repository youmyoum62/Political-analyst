import type { Metadata } from 'next';
import Link from 'next/link';

import { ContentPage, ContentSection } from '@/components/ContentPage';
import { CONTENT_UPDATED } from '@/lib/site';

export const metadata: Metadata = {
  title: '法案が成立するまで',
  description:
    '法案が国会に提出されてから成立するまでの流れを、提出・委員会審議・本会議・衆参の関係・会期の概念を含めてやさしく解説します。閣法と議員立法の違いもわかります。',
};

export default function HowABillBecomesLawPage() {
  return (
    <ContentPage
      title="法案が成立するまで"
      lead="法案が国会に提出されてから成立するまでの流れを、委員会審議・本会議・衆参の関係を含めて解説します。"
      updated={CONTENT_UPDATED}
    >
      <ContentSection heading="法案には2つの出どころがある">
        <p>
          国会に提出される法律案（法案）は、大きく分けて2種類あります。内閣が提出する
          <span className="font-bold text-ink">閣法（内閣提出法案）</span>と、国会議員が提出する
          <span className="font-bold text-ink">議員立法（議員提出法案）</span>です。閣法は各省庁が原案を
          作り内閣として提出するため成立率が高く、議員立法は議員が主体的に発議するもので、当サイトの
          立法実績スコアでは後者の「議員個人の関与」を主に捉えています。
        </p>
      </ContentSection>

      <ContentSection heading="① 提出">
        <p>
          法案は衆議院または参議院に提出されます。議員立法の場合、一定数の賛成者（発議者・賛成者）を
          そろえて発議します。提出された法案は受理され、原則としてまず委員会に付託されます。
        </p>
      </ContentSection>

      <ContentSection heading="② 委員会審議">
        <p>
          国会の実質的な審議は、分野ごとに設けられた
          <span className="font-bold text-ink">委員会</span>で行われます（予算委員会、法務委員会など）。
          委員会では提案理由の説明、質疑、参考人の意見聴取などを経て、採決が行われます。ここで多くの
          議論が交わされるため、委員会での質問・発言は議員の活動を測るうえで重要な情報源になります。
        </p>
      </ContentSection>

      <ContentSection heading="③ 本会議">
        <p>
          委員会で可決された法案は、その院の
          <span className="font-bold text-ink">本会議</span>にかけられ、全議員による採決が行われます。
          本会議で可決されると、法案はもう一方の院（衆議院なら参議院、その逆も）へ送られます。
        </p>
      </ContentSection>

      <ContentSection heading="④ もう一方の院へ（衆参の関係）">
        <p>
          日本の国会は二院制で、法案は原則として両院で可決されて初めて成立します。両院で議決が異なる
          場合は、両院協議会が開かれることがあります。予算や条約、内閣総理大臣の指名などでは衆議院の
          議決が優先される「衆議院の優越」がありますが、一般の法律案については、衆議院で出席議員の
          3分の2以上の多数で再可決すれば成立させることができます。
        </p>
      </ContentSection>

      <ContentSection heading="⑤ 成立・公布">
        <p>
          両院で可決された法案は成立し、内閣の助言と承認にもとづき天皇が公布します。公布された法律は、
          定められた日から施行されます。当サイトの政策実現スコアは、この「成立まで到達したか」を
          結果として評価しています。
        </p>
      </ContentSection>

      <ContentSection heading="会期という時間の制約">
        <p>
          国会には<span className="font-bold text-ink">会期</span>（活動できる期間）があり、常会（通常国会）・
          臨時会・特別会に分かれます。原則として、会期中に成立しなかった法案は次の会期に引き継がれず廃案に
          なります（会期不継続の原則。ただし継続審査の手続きをとれば持ち越せます）。「審議中」の法案が多い
          時期や、会期末が近い時期は、法案の動きが活発になります。
        </p>
        <p>
          いま国会でどんな法案が動いているかは、トップページの「国会の動き」欄でも確認できます。スコアの
          算出方法については
          {' '}
          <Link href="/guide/how-scores-work" className="text-accent hover:underline">スコアの読み方</Link>
          {' '}
          を、用語の意味は
          {' '}
          <Link href="/guide/glossary" className="text-accent hover:underline">国会用語集</Link>
          {' '}
          をご覧ください。
        </p>
      </ContentSection>
    </ContentPage>
  );
}
