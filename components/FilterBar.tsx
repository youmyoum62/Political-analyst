'use client';

import { AgeGroup } from '@/lib/api';

type Props = {
  ageGroup: AgeGroup;
  party: string;
  gender: string;
  parties: string[];
  onAgeGroupChange: (value: AgeGroup) => void;
  onPartyChange: (value: string) => void;
  onGenderChange: (value: string) => void;
};

export function FilterBar({ ageGroup, party, gender, parties, onAgeGroupChange, onPartyChange, onGenderChange }: Props) {
  return (
    <div className="sticky top-0 z-20 -mx-6 mb-4 border-y border-slate-700 bg-slate-950/95 px-6 py-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Filter the narrative</p>
        <p className="text-xs text-slate-400">Updates instantly</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <select className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold" value={ageGroup} onChange={(e) => onAgeGroupChange(e.target.value as AgeGroup)}>
          <option>All</option>
          <option>20s-30s</option>
          <option>40s-50s</option>
          <option>60+</option>
        </select>

        <select className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold" value={party} onChange={(e) => onPartyChange(e.target.value)}>
          {parties.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <select className="rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold" value={gender} onChange={(e) => onGenderChange(e.target.value)}>
          <option>All</option>
          <option>Female</option>
          <option>Male</option>
        </select>
      </div>
    </div>
  );
}
