import { politicians } from '@/lib/mock-data';
import { Politician } from '@/lib/types';

export type AgeGroup = 'All' | '20s-30s' | '40s-50s' | '60+';

export function getRankedPoliticians(): Politician[] {
  return [...politicians].sort((a, b) => b.score - a.score).slice(0, 20);
}

export function getPoliticianById(id: number): Politician | undefined {
  return politicians.find((p) => p.id === id);
}

function withCurrentRank(data: Politician[]): Array<Politician & { currentRank: number; rankDelta: number }> {
  return data.map((p, index) => {
    const currentRank = index + 1;
    return { ...p, currentRank, rankDelta: p.previousRank - currentRank };
  });
}

export function getRisingPoliticians(limit = 3): Array<Politician & { currentRank: number; rankDelta: number }> {
  return withCurrentRank(getRankedPoliticians())
    .filter((p) => p.rankDelta > 0)
    .sort((a, b) => b.rankDelta - a.rankDelta)
    .slice(0, limit);
}

export function getBiggestDrops(limit = 3): Array<Politician & { currentRank: number; rankDelta: number }> {
  return withCurrentRank(getRankedPoliticians())
    .filter((p) => p.rankDelta < 0)
    .sort((a, b) => a.rankDelta - b.rankDelta)
    .slice(0, limit);
}

export function filterPoliticians(data: Politician[], options: { ageGroup: AgeGroup; party: string; gender: string }): Politician[] {
  return data.filter((person) => {
    const ageGroupPass =
      options.ageGroup === 'All' ||
      (options.ageGroup === '20s-30s' && person.age < 40) ||
      (options.ageGroup === '40s-50s' && person.age >= 40 && person.age < 60) ||
      (options.ageGroup === '60+' && person.age >= 60);

    const partyPass = options.party === 'All' || person.party === options.party;
    const genderPass = options.gender === 'All' || person.gender === options.gender;

    return ageGroupPass && partyPass && genderPass;
  });
}

export function getParties(): string[] {
  return ['All', ...Array.from(new Set(politicians.map((p) => p.party)))];
}
