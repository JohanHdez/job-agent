/**
 * Types related to job listings, applications, and results.
 */

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  modality: 'Remote' | 'Hybrid' | 'On-site';
  description: string;
  requiredSkills: string[];
  postedAt: string;
  applyUrl: string;
  hasEasyApply: boolean;
  compatibilityScore: number;
}

export type ApplicationStatus =
  | 'applied'
  | 'easy_apply_not_available'
  | 'already_applied'
  | 'failed'
  | 'skipped_low_score';

export interface ApplicationRecord {
  job: JobListing;
  status: ApplicationStatus;
  appliedAt: string;
  errorMessage?: string;
}

/** Summary stats for a completed session */
export interface SessionSummary {
  totalFound: number;
  totalScored: number;
  totalApplied: number;
  totalSkipped: number;
  totalFailed: number;
  sessionStartedAt: string;
  sessionEndedAt: string;
  durationSeconds: number;
}

/** Rate limit check result */
export interface RateLimitStatus {
  shouldPause: boolean;
  reason?: string;
  resumeAfterMs?: number;
}
