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

const HOUSE_OPTIONS: { value: HouseFilter; label: string }[] = [
  { value: 'All', label: '両院' },
  { value: 'representatives', label: '衆議院' },
  { value: 'councillors', label: '参議院' },
];

export function FilterBar({
  ageGroup, party, gender, house, query, parties, showInactive, inactiveCount,
  onAgeGroupChange, onPartyChange, onGenderChange, onHouseChange,
  onQueryChange, onShowInactiveChange,
}: Props) {
  return (
    <div className="sticky top-0 z-20 -mx-6 mb-4 border-y border-line bg-canvas/95 px-6 py-3 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">絞り込み</p>
        <p className="text-xs text-muted">即座に更新</p>
      </div>

      <div className="mb-3 rounded-xl border border-line bg-surface p-3">
        {/* 院フィルター：セグメントコントロール */}
        <div className="mb-3 flex rounded-lg border border-line bg-canvas p-0.5" role="radiogroup" aria-label="院で絞り込む">
          {HOUSE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={house === opt.value}
              onClick={() => onHouseChange(opt.value)}
              className={`flex-1 rounded-md py-2 text-sm font-bold transition ${
                house === opt.value ? 'bg-surface text-accent shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 名前検索 */}
        <input
          type="text"
          aria-label="名前・政党・選挙区で検索"
          placeholder="名前・政党・選挙区で検索…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="mb-3 w-full rounded-lg border border-line bg-canvas px-4 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="年代で絞り込む"
            className="rounded-full border border-line bg-canvas px-3 py-1.5 text-xs font-semibold text-muted focus:border-accent focus:outline-none"
            value={ageGroup}
            onChange={(e) => onAgeGroupChange(e.target.value as AgeGroup)}
          >
            <option value="All">年代 ▾</option>
            <option value="20s-30s">20〜30代</option>
            <option value="40s-50s">40〜50代</option>
            <option value="60+">60代以上</option>
          </select>

          <select
            aria-label="党派で絞り込む"
            className="rounded-full border border-line bg-canvas px-3 py-1.5 text-xs font-semibold text-muted focus:border-accent focus:outline-none"
            value={party}
            onChange={(e) => onPartyChange(e.target.value)}
          >
            {parties.map((item) => (
              <option key={item} value={item}>{item === 'All' ? '政党 ▾' : item}</option>
            ))}
          </select>

          <select
            aria-label="性別で絞り込む"
            className="rounded-full border border-line bg-canvas px-3 py-1.5 text-xs font-semibold text-muted focus:border-accent focus:outline-none"
            value={gender}
            onChange={(e) => onGenderChange(e.target.value)}
          >
            <option value="All">性別 ▾</option>
            <option value="Female">女性</option>
            <option value="Male">男性</option>
          </select>

          <button
            onClick={() => onShowInactiveChange(!showInactive)}
            className={`ml-auto rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              showInactive ? 'border-down bg-down/10 text-down' : 'border-line text-muted hover:text-ink'
            }`}
          >
            発言データなし {showInactive ? '表示中' : `(${inactiveCount}名)`}
          </button>

          {(ageGroup !== 'All' || party !== 'All' || gender !== 'All' || house !== 'All' || query !== '') && (
            <button
              onClick={() => {
                onAgeGroupChange('All');
                onPartyChange('All');
                onGenderChange('All');
                onHouseChange('All');
                onQueryChange('');
              }}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
            >
              ✕ リセット
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
