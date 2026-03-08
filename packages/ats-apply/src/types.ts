/**
 * Internal types for the ats-apply package.
 */

/** Which ATS platform was detected from a job URL. */
export type AtsType = 'greenhouse' | 'lever';

/**
 * Result of ATS detection — the platform type plus the identifiers
 * needed to call the application API.
 */
export interface AtsMatch {
  type: AtsType;
  /** Company slug / board token (used in the API path). */
  company: string;
  /** Job / posting ID. */
  jobId: string;
}
