'use client';

import { AgeGroup, HouseFilter } from '@/lib/api';

type Props = {
  ageGroup: AgeGroup;
  party: string;
  gender: string;
  house: HouseFilter;
  query: string;
  parties: string[];
  showInactive: boolean;
  inactiveCount: number;
  onAgeGroupChange: (value: AgeGroup) => void;
  onPartyChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onHouseChange: (value: HouseFilter) => void;
  onQueryChange: (value: string) => void;
  onShowInactiveChange: (value: boolean) => void;
};

export function FilterBar({
  ageGroup, party, gender, house, query, parties, showInactive, inactiveCount,
  onAgeGroupChange, onPartyChange, onGenderChange, onHouseChange,
  onQueryChange, onShowInactiveChange,
}: Props) {
  return (
    <div className="sticky top-0 z-20 -mx-6 mb-4 border-y border-slate-700 bg-slate-950/95 px-6 py-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">絞り込む</p>
        <p className="text-xs text-slate-400">即座に更新</p>
      </div>

      {/* 名前検索 */}
      <div className="mb-3">
        <input
          type="text"
          aria-label="名前・政党・選挙区で検索"
          placeholder="名前・政党・選挙区で検索..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
      </div>

      <div className="flex flex-wrap gap-3 pb-1">
        {/* 院別フィルター */}
        <select
          aria-label="院で絞り込む"
          className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400"
          value={house}
          onChange={(e) => onHouseChange(e.target.value as HouseFilter)}
        >
          <option value="All">衆参両院</option>
          <option value="representatives">衆議院</option>
          <option value="councillors">参議院</option>
        </select>

        {/* 年代フィルター */}
        <select
          aria-label="年代で絞り込む"
          className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400"
          value={ageGroup}
          onChange={(e) => onAgeGroupChange(e.target.value as AgeGroup)}
        >
          <option value="All">すべての年代</option>
          <option value="20s-30s">20〜30代</option>
          <option value="40s-50s">40〜50代</option>
          <option value="60+">60代以上</option>
        </select>

        {/* 政党フィルター */}
        <select
          aria-label="党派で絞り込む"
          className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400"
          value={party}
          onChange={(e) => onPartyChange(e.target.value)}
        >
          {parties.map((item) => (
            <option key={item} value={item}>{item === 'All' ? 'すべての党派' : item}</option>
          ))}
        </select>

        {/* 性別フィルター */}
        <select
          aria-label="性別で絞り込む"
          className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400"
          value={gender}
          onChange={(e) => onGenderChange(e.target.value)}
        >
          <option value="All">すべて</option>
          <option value="Female">女性</option>
          <option value="Male">男性</option>
        </select>

        {/* 発言ゼロ表示トグル */}
        <button
          onClick={() => onShowInactiveChange(!showInactive)}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${
            showInactive
              ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
              : 'border-slate-600 bg-slate-900 text-slate-400 hover:border-rose-400/40 hover:text-rose-300'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          発言ゼロ {showInactive ? '表示中' : `(${inactiveCount}名)`}
        </button>

        {/* リセットボタン */}
        {(ageGroup !== 'All' || party !== 'All' || gender !== 'All' || house !== 'All' || query !== '') && (
          <button
            onClick={() => {
              onAgeGroupChange('All');
              onPartyChange('All');
              onGenderChange('All');
              onHouseChange('All');
              onQueryChange('');
            }}
            className="rounded-full border border-slate-500/50 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
          >
            ✕ リセット
          </button>
        )}
      </div>
    </div>
  );
}
