'use client';

import { AgeGroup } from '@/lib/api';

type Props = {
  ageGroup: AgeGroup;
  party: string;
  gender: string;
  parties: string[];
  showInactive: boolean;
  inactiveCount: number;
  onAgeGroupChange: (value: AgeGroup) => void;
  onPartyChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onShowInactiveChange: (value: boolean) => void;
};

export function FilterBar({
  ageGroup, party, gender, parties, showInactive, inactiveCount,
  onAgeGroupChange, onPartyChange, onGenderChange, onShowInactiveChange,
}: Props) {
  return (
    <div className="sticky top-0 z-20 -mx-6 mb-4 border-y border-slate-700 bg-slate-950/95 px-6 py-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">絞り込む</p>
        <p className="text-xs text-slate-400">即座に更新</p>
      </div>
      <div className="flex flex-wrap gap-3 pb-1">
        <select
          className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold"
          value={ageGroup}
          onChange={(e) => onAgeGroupChange(e.target.value as AgeGroup)}
        >
          <option value="All">すべて</option>
          <option value="20s-30s">20〜30代</option>
          <option value="40s-50s">40〜50代</option>
          <option value="60+">60代以上</option>
        </select>

        <select
          className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold"
          value={party}
          onChange={(e) => onPartyChange(e.target.value)}
        >
          {parties.map((item) => (
            <option key={item} value={item}>{item === 'All' ? 'すべての党派' : item}</option>
          ))}
        </select>

        <select
          className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold"
          value={gender}
          onChange={(e) => onGenderChange(e.target.value)}
        >
          <option value="All">すべて</option>
          <option value="Female">女性</option>
          <option value="Male">男性</option>
        </select>

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
      </div>
    </div>
  );
}
