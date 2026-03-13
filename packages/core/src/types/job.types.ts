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

// ── SSE event types ───────────────────────────────────────────────────────────

/** Named event types emitted on the SSE stream (GET /api/search/events) */
export type SseEventType =
  | 'job_found'
  | 'job_applied'
  | 'job_skipped'
  | 'session_complete'
  | 'captcha_detected'
  | 'progress';

/** Base payload included in every SSE event */
export interface SseBasePayload {
  type: SseEventType;
  timestamp: string;
}

/** Emitted each time a new job is discovered during search */
export interface SseJobFoundPayload extends SseBasePayload {
  type: 'job_found';
  jobId: string;
  title: string;
  company: string;
  platform: string;
  score: number;
  totalFound: number;
}

/** Emitted each time an application is submitted successfully */
export interface SseJobAppliedPayload extends SseBasePayload {
  type: 'job_applied';
  jobId: string;
  title: string;
  company: string;
  method: ApplicationMethod;
  totalApplied: number;
}

/** Emitted each time a job is skipped (low score or already applied) */
export interface SseJobSkippedPayload extends SseBasePayload {
  type: 'job_skipped';
  jobId: string;
  title: string;
  company: string;
  reason: 'low_score' | 'already_applied' | 'no_method';
  totalSkipped: number;
}

/** Emitted when the full session finishes (success or error) */
export interface SseSessionCompletePayload extends SseBasePayload {
  type: 'session_complete';
  success: boolean;
  totalFound: number;
  totalApplied: number;
  totalSkipped: number;
  durationSeconds: number;
  error?: string;
}

/** Emitted when a CAPTCHA or unusual activity warning is detected */
export interface SseCaptchaPayload extends SseBasePayload {
  type: 'captcha_detected';
  platform: string;
  message: string;
}

/** Generic pipeline progress event */
export interface SseProgressPayload extends SseBasePayload {
  type: 'progress';
  step: number;
  total: number;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
  done?: boolean;
  error?: string;
}

export type SsePayload =
  | SseJobFoundPayload
  | SseJobAppliedPayload
  | SseJobSkippedPayload
  | SseSessionCompletePayload
  | SseCaptchaPayload
  | SseProgressPayload;
