export type Gender = 'Male' | 'Female';

export type PoliticianScoreBreakdown = {
  activity: number;
  questionQuality: number;
  legislation: number;
  influence: number;
  impact: number;
};

export type Politician = {
  id: number;
  name: string;
  party: string;
  age: number;
  gender: Gender;
  district: string;
  house: 'representatives' | 'councillors';
  score: number;
  previousRank: number;
  topQuestion: string;
  keyAchievement: string;
  summary: string;
  metrics: PoliticianScoreBreakdown;
  isInactive: boolean;
};
