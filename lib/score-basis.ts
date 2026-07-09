/**
 * 議員詳細ページ「スコアの根拠」欄（A4）で使う集計ユーティリティ。
 *
 * 各スコア軸の点数を「その議員の実カウント」で裏付けるための純関数群。
 * 集計対象は API が返す一次情報（bills / roles / top_speeches）のみで、
 * ハードコードした決め打ちの数値や、スコアの算出式を再現した推定値は持たない
 * （捏造・思い込みの防止）。裏付けとなる実データが無い軸は evidence=false とし、
 * 呼び出し側で「データ収集中」等の正直な表示に振り分ける。
 *
 * 重要: これは「スコア＝この式でこの点数」という因果の主張ではなく、
 * 「この軸に関連する、当サイトが集計した実データ」の提示である。文言もそれに揃える。
 */

import type { PoliticianBill, PoliticianRole, TopSpeech } from './api-client';

// --- 法案（立法実績・政策実現の裏付け） ---

export type BillTally = {
  total: number;
  /** role === 'primary'（提出者）。 */
  primary: number;
  /** role === 'co'（賛成者・共同提出者）。 */
  co: number;
  /** role === 'committee'（委員会提出）。 */
  committee: number;
  /** 上記いずれにも当てはまらない role。 */
  otherRole: number;
  /** status === 'passed'（成立）。 */
  passed: number;
  /** status === 'in_committee'（審議中）。 */
  inCommittee: number;
  /** status === 'submitted'（提出）。 */
  submitted: number;
  /** status === 'withdrawn'（撤回）。 */
  withdrawn: number;
};

export function tallyBills(bills: PoliticianBill[] | null | undefined): BillTally {
  const t: BillTally = {
    total: 0,
    primary: 0,
    co: 0,
    committee: 0,
    otherRole: 0,
    passed: 0,
    inCommittee: 0,
    submitted: 0,
    withdrawn: 0,
  };
  if (!bills) return t;
  for (const b of bills) {
    t.total += 1;
    if (b.role === 'primary') t.primary += 1;
    else if (b.role === 'co') t.co += 1;
    else if (b.role === 'committee') t.committee += 1;
    else t.otherRole += 1;

    if (b.status === 'passed') t.passed += 1;
    else if (b.status === 'in_committee') t.inCommittee += 1;
    else if (b.status === 'submitted') t.submitted += 1;
    else if (b.status === 'withdrawn') t.withdrawn += 1;
  }
  return t;
}

// --- 役職（影響力の裏付け） ---

/** 院内・党内の要職とみなす役職名（影響力の中核）。前方一致で判定する。 */
const LEADERSHIP_ROLE_PREFIXES = [
  '委員長',
  '副委員長',
  '理事',
  '会長',
  '副会長',
  '幹事長',
  '副幹事長',
  '議長',
  '副議長',
  '大臣',
  '副大臣',
  '政務官',
];

export type RoleTally = {
  total: number;
  /** 役職名ごとの件数。件数降順（同数は名称の昇順）で安定ソート。 */
  byName: { name: string; count: number }[];
  /** 要職（委員長・理事・党幹部等）の件数。 */
  leadership: number;
};

function isLeadership(roleName: string): boolean {
  return LEADERSHIP_ROLE_PREFIXES.some((p) => roleName.startsWith(p));
}

export function tallyRoles(roles: PoliticianRole[] | null | undefined): RoleTally {
  const counts = new Map<string, number>();
  let leadership = 0;
  let total = 0;
  if (roles) {
    for (const r of roles) {
      const name = r.role_name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
      total += 1;
      if (isLeadership(name)) leadership += 1;
    }
  }
  const byName = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { total, byName, leadership };
}

// --- 発言（発言品質の裏付け） ---

export type SpeechTally = {
  count: number;
  /** AI評価スコアの平均（score 非 null のもの）。1件も無ければ null。 */
  avgScore: number | null;
};

export function tallySpeeches(speeches: TopSpeech[] | null | undefined): SpeechTally {
  if (!speeches || speeches.length === 0) return { count: 0, avgScore: null };
  const scores = speeches.map((s) => s.score).filter((s): s is number => s != null);
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;
  return { count: speeches.length, avgScore };
}

// --- 軸ごとの根拠モデル ---

export type ScoreAxisKey =
  | 'participation'
  | 'quality'
  | 'legislative'
  | 'policy_impact'
  | 'influence';

export type AxisBasis = {
  key: ScoreAxisKey;
  label: string;
  score: number;
  /** true = その議員の実カウントで裏付けられる。false = 裏付けデータ未収集/未公開。 */
  hasEvidence: boolean;
  /** 裏付けとなる実カウントの箇条書き（hasEvidence=true のとき非空）。 */
  facts: string[];
  /** hasEvidence=false のときの正直な注記。 */
  note?: string;
};

const AXIS_LABELS: Record<ScoreAxisKey, string> = {
  participation: '議会参加',
  quality: '発言品質',
  legislative: '立法実績',
  policy_impact: '政策実現',
  influence: '影響力',
};

/** roleTally.byName から、ラベル用の要約文字列（例: 委員長1件・理事2件）を作る。 */
function roleFactStrings(roleTally: RoleTally): string[] {
  return roleTally.byName.map((r) => `${r.name} ${r.count}件`);
}

export type ScoreBasisInput = {
  participation_score: number;
  quality_score: number;
  legislative_score: number;
  policy_impact_score: number;
  influence_score: number;
  bills?: PoliticianBill[] | null;
  roles?: PoliticianRole[] | null;
  top_speeches?: TopSpeech[] | null;
};

/**
 * 5軸それぞれについて、実カウントに基づく根拠（AxisBasis）を組み立てる。
 * - 立法実績 / 政策実現: bills から集計（同じ bills を、提出への関与／成立という結果の
 *   別の側面で提示する）。
 * - 影響力: roles から集計。
 * - 発言品質: top_speeches（AI評価済み発言）から集計。本番では未整備で空のことが多い。
 * - 議会参加: 質問・出席の実回数を API が公開していないため、実カウントの裏付けは持たない。
 * いずれも「この式でこの点数」という主張はせず、関連する実データの提示に留める。
 */
export function buildScoreBasis(input: ScoreBasisInput): AxisBasis[] {
  const bills = tallyBills(input.bills);
  const roles = tallyRoles(input.roles);
  const speeches = tallySpeeches(input.top_speeches);

  const result: AxisBasis[] = [];

  // 議会参加: 実カウントの公開が無いため裏付けなし。
  result.push({
    key: 'participation',
    label: AXIS_LABELS.participation,
    score: input.participation_score,
    hasEvidence: false,
    facts: [],
    note: '質問・発言・出席の個別回数は、集計・公開の準備中です。',
  });

  // 発言品質: AI評価済み発言があれば裏付け。
  if (speeches.count > 0) {
    const facts = [`AI評価済みの注目発言 ${speeches.count}件`];
    if (speeches.avgScore != null) facts.push(`AI評価スコア平均 ${speeches.avgScore.toFixed(1)}`);
    result.push({
      key: 'quality',
      label: AXIS_LABELS.quality,
      score: input.quality_score,
      hasEvidence: true,
      facts,
    });
  } else {
    result.push({
      key: 'quality',
      label: AXIS_LABELS.quality,
      score: input.quality_score,
      hasEvidence: false,
      facts: [],
      note: '発言のAI評価はデータ収集中です。',
    });
  }

  // 立法実績: 提出への関与（主提出／共同提出）。
  if (bills.total > 0) {
    const facts: string[] = [];
    if (bills.primary > 0) facts.push(`主提出 ${bills.primary}件`);
    if (bills.co > 0) facts.push(`共同提出 ${bills.co}件`);
    if (bills.committee > 0) facts.push(`委員会提出 ${bills.committee}件`);
    facts.push(`関与した法案 計${bills.total}件`);
    result.push({
      key: 'legislative',
      label: AXIS_LABELS.legislative,
      score: input.legislative_score,
      hasEvidence: true,
      facts,
    });
  } else {
    result.push({
      key: 'legislative',
      label: AXIS_LABELS.legislative,
      score: input.legislative_score,
      hasEvidence: false,
      facts: [],
      note: '提出・共同提出した法案のデータは、まだ登録されていません。',
    });
  }

  // 政策実現: 成立という結果。
  if (bills.total > 0) {
    const facts: string[] = [`成立 ${bills.passed}件`];
    if (bills.inCommittee > 0) facts.push(`審議中 ${bills.inCommittee}件`);
    if (bills.submitted > 0) facts.push(`提出 ${bills.submitted}件`);
    if (bills.withdrawn > 0) facts.push(`撤回 ${bills.withdrawn}件`);
    facts.push(`関与した法案 計${bills.total}件`);
    result.push({
      key: 'policy_impact',
      label: AXIS_LABELS.policy_impact,
      score: input.policy_impact_score,
      hasEvidence: true,
      facts,
    });
  } else {
    result.push({
      key: 'policy_impact',
      label: AXIS_LABELS.policy_impact,
      score: input.policy_impact_score,
      hasEvidence: false,
      facts: [],
      note: '成立・審議状況を集計できる法案データは、まだ登録されていません。',
    });
  }

  // 影響力: 役職。
  if (roles.total > 0) {
    const facts = roleFactStrings(roles);
    result.push({
      key: 'influence',
      label: AXIS_LABELS.influence,
      score: input.influence_score,
      hasEvidence: true,
      facts,
    });
  } else {
    result.push({
      key: 'influence',
      label: AXIS_LABELS.influence,
      score: input.influence_score,
      hasEvidence: false,
      facts: [],
      note: '委員会・党の役職データは、まだ登録されていません。',
    });
  }

  return result;
}

/** 実データの裏付けがある軸が1つでもあるか（コンポーネントの表示要否判定に使う）。 */
export function hasAnyEvidence(basis: AxisBasis[]): boolean {
  return basis.some((b) => b.hasEvidence);
}
