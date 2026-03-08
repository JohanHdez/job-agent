/**
 * Types related to job listings, applications, and results.
 */

import type { PlatformId } from './config.types.js';

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
  platform: PlatformId;
}

export type ApplicationStatus =
  | 'applied'
  | 'easy_apply_not_available'
  | 'already_applied'
  | 'failed'
  | 'skipped_low_score';

/** How the application was submitted (only present when status === 'applied'). */
export type ApplicationMethod =
  | 'linkedin_easy_apply'
  | 'greenhouse_api'
  | 'lever_api'
  | 'email'
  | 'manual';

export interface ApplicationRecord {
  job: JobListing;
  status: ApplicationStatus;
  appliedAt: string;
  errorMessage?: string;
  /** Which mechanism submitted the application. */
  applicationMethod?: ApplicationMethod;
  /**
   * Proof-of-submission identifier returned by the ATS or mail server:
   *   - Greenhouse → numeric application ID (e.g. "123456789")
   *   - Lever      → application UUID
   *   - Email      → SMTP message-id (e.g. "<uuid@smtp.gmail.com>")
   */
  confirmationId?: string;
}

/** Summary stats for a completed session */
export interface SessionSummary {
  totalFound: number;
  totalScored: number;
  totalApplied: number;
  totalSkipped: number;
  totalManual: number;
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
