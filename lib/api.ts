import { Politician } from '@/lib/types';

export type AgeGroup = 'All' | '20s-30s' | '40s-50s' | '60+';

export function getRankedPoliticians(politicians: Politician[]): Politician[] {
  return [...politicians].sort((a, b) => b.score - a.score);
}

export function getRisingPoliticians(
  politicians: Politician[],
  limit = 3,
): Array<Politician & { rankDelta: number }> {
  return getRankedPoliticians(politicians)
    .map((p) => ({ ...p, rankDelta: p.trend }))
    .filter((p) => p.rankDelta > 0)
    .sort((a, b) => b.rankDelta - a.rankDelta)
    .slice(0, limit);
}

export function getBiggestDrops(
  politicians: Politician[],
  limit = 3,
): Array<Politician & { rankDelta: number }> {
  return getRankedPoliticians(politicians)
    .map((p) => ({ ...p, rankDelta: p.trend }))
    .filter((p) => p.rankDelta < 0)
    .sort((a, b) => a.rankDelta - b.rankDelta)
    .slice(0, limit);
}

export function filterPoliticians(
  data: Politician[],
  options: { ageGroup: AgeGroup; party: string; gender: string; showInactive: boolean },
): Politician[] {
  return data.filter((person) => {
    if (!options.showInactive && person.isInactive) return false;

    const ageGroupPass =
      options.ageGroup === 'All' ||
      (options.ageGroup === '20s-30s' && person.age !== null && person.age < 40) ||
      (options.ageGroup === '40s-50s' && person.age !== null && person.age >= 40 && person.age < 60) ||
      (options.ageGroup === '60+' && person.age !== null && person.age >= 60);

    const partyPass = options.party === 'All' || person.party === options.party;
    const genderPass = options.gender === 'All' || person.gender === options.gender;

    return ageGroupPass && partyPass && genderPass;
  });
}

export function getParties(politicians: Politician[]): string[] {
  return ['All', ...Array.from(new Set(politicians.map((p) => p.party)))];
}
