/**
 * Types for job vacancies discovered during search sessions.
 * A vacancy is persisted to MongoDB after discovery and scoring.
 */

import type { PlatformId } from './config.types.js';

/**
 * How the recipient email was detected for a vacancy.
 * - apply_options: extracted from a mailto: link in the JSearch apply_options array
 * - jd_regex:      extracted via email regex scan of the job description text
 * - manual_required: no email found automatically; user must provide it manually
 */
export type EmailDetectionMethod = 'apply_options' | 'jd_regex' | 'manual_required';

/** Status of a vacancy in the user's application history */
export type VacancyStatus = 'new' | 'applied' | 'dismissed' | 'failed';

/**
 * Snapshot of the user's active search preset embedded in the Session
 * document at creation time. Preserves the exact config used for a session
 * so historical records remain accurate even after preset edits.
 */
export interface SearchConfigSnapshotType {
  /** Keywords used for the search */
  keywords: string[];
  /** Target location string */
  location: string;
  /** Allowed work modalities */
  modality: ('Remote' | 'Hybrid' | 'On-site')[];
  /** Platforms searched in this session */
  platforms: PlatformId[];
  /** Target seniority levels */
  seniority: string[];
  /** Required spoken languages */
  languages: string[];
  /** Recency filter applied to search results */
  datePosted: 'past_24h' | 'past_week' | 'past_month';
  /** Minimum compatibility score required to trigger an application */
  minScoreToApply: number;
  /** Maximum number of applications allowed in this session */
  maxApplicationsPerSession: number;
  /** Companies excluded from consideration */
  excludedCompanies: string[];
}

/**
 * A job vacancy discovered during a search session.
 * Persisted in the `vacancies` MongoDB collection with per-user dedup indexes.
 * Conforms to NF-08 row-level security: all queries MUST filter by `userId`.
 */
export interface VacancyType {
  /** JSearch job_id or platform-specific unique identifier */
  jobId: string;
  /** Job title as shown on the platform */
  title: string;
  /** Company posting the role */
  company: string;
  /** Full job description text */
  description: string;
  /** Direct URL to the job listing */
  url: string;
  /** Location string (e.g. "Remote", "Buenos Aires, AR") */
  location: string;
  /** Source platform for this vacancy */
  platform: PlatformId;
  /** ISO 8601 date string when the job was originally posted */
  postedAt: string;
  /** 0–100 compatibility score assigned by the scoring engine */
  compatibilityScore: number;
  /** Brief explanation of the score from the LLM scorer (max 15 words) */
  scoreReason: string;
  /** Current status in the user's vacancy history */
  status: VacancyStatus;
  /** MongoDB ObjectId string of the user who owns this record (NF-08) */
  userId: string;
  /** MongoDB ObjectId string of the session that discovered this vacancy */
  sessionId: string;
  /** ISO 8601 timestamp when this vacancy was first persisted */
  discoveredAt: string;
  /**
   * Reason this vacancy was filtered out locally before persistence or scoring.
   * Only set when the vacancy was not processed to completion.
   */
  filterReason?: 'missing_fields' | 'excluded_company' | 'duplicate' | 'score_below_threshold';
  /**
   * Recipient email address extracted at vacancy persist time (Phase 5).
   * Undefined when email detection has not run or no email was found via any method.
   */
  recipientEmail?: string;
  /**
   * How the recipientEmail was detected (Phase 5).
   * Always set alongside recipientEmail by the email detection utility.
   */
  emailDetectionMethod?: EmailDetectionMethod;
}
