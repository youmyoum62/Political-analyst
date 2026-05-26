export type Gender = 'Male' | 'Female';

export type RoleProfile = 'opposition' | 'ruling' | 'cabinet' | 'parliamentary';

export type PoliticianScoreBreakdown = {
  participation: number;
  questionQuality: number;
  legislation: number;
  policyImpact: number;
  influence: number;
};

export type Politician = {
  id: number;
  name: string;
  party: string;
  age: number | null;
  gender: Gender | null;
  district: string;
  house: 'representatives' | 'councillors';
  roleProfile: RoleProfile;
  score: number;
  trend: number;
  topQuestion: string;
  keyAchievement: string;
  summary: string;
  metrics: PoliticianScoreBreakdown;
  isInactive: boolean;
};
