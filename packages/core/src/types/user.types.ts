import type { PlatformId } from './config.types.js';

/** A named search configuration preset saved per-user. */
export interface SearchPresetType {
  id: string;
  name: string;
  keywords: string[];
  location: string;
  modality: ('Remote' | 'Hybrid' | 'On-site')[];
  platforms: PlatformId[];
  seniority: string[];
  languages: string[];
  datePosted: 'past_24h' | 'past_week' | 'past_month';
  minScoreToApply: number;
  maxApplicationsPerSession: number;
  excludedCompanies: string[];
}
