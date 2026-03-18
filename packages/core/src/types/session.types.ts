/**
 * Session event types and status for the job-search automation pipeline.
 * These are the locked event schema — do not change field names without
 * a coordinated migration of the sessions MongoDB collection.
 */

/** Lifecycle status of a search session */
export type SessionStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';

/**
 * Event emitted when a session begins execution.
 * Contains a snapshot of the search config at start time.
 */
export interface SessionStartedEvent {
  type: 'session_started';
  /** MongoDB ObjectId string of the session document */
  sessionId: string;
  /** MongoDB ObjectId string of the owning user */
  userId: string;
  /** Search configuration snapshot captured at session start */
  config: Record<string, unknown>;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Event emitted when a job listing is discovered during the search phase.
 */
export interface JobFoundEvent {
  type: 'job_found';
  /** Platform-scoped unique identifier for this job listing */
  jobId: string;
  /** Job title as shown on the platform */
  title: string;
  /** Company name */
  company: string;
  /** Location string (e.g. "Remote", "Buenos Aires, AR") */
  location: string;
  /** Platform identifier (e.g. "linkedin", "greenhouse") */
  platform: string;
  /** 0–100 compatibility score calculated by the matching engine */
  compatibilityScore: number;
  /** Direct URL to the job listing */
  url: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Event emitted when a job is intentionally skipped (not applied to).
 */
export interface JobSkippedEvent {
  type: 'job_skipped';
  /** Platform-scoped unique identifier for this job listing */
  jobId: string;
  /** Reason the job was skipped */
  reason: 'score_too_low' | 'already_applied' | 'excluded_company' | 'missing_fields';
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Event emitted when an application is submitted (or attempted) for a job.
 */
export interface ApplicationMadeEvent {
  type: 'application_made';
  /** Platform-scoped unique identifier for this job listing */
  jobId: string;
  /** Submission method used */
  method: 'easy_apply' | 'email';
  /** Outcome of the application attempt */
  status: 'success' | 'failed';
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Event emitted when a session finishes successfully (all jobs processed).
 */
export interface SessionCompleteEvent {
  type: 'session_complete';
  /** MongoDB ObjectId string of the session document */
  sessionId: string;
  /** Aggregate counters for the entire session */
  totals: {
    /** Total jobs found across all platforms */
    found: number;
    /** Jobs successfully applied to */
    applied: number;
    /** Jobs explicitly skipped */
    skipped: number;
    /** Application attempts that failed */
    failed: number;
  };
  /** Total wall-clock duration in milliseconds */
  durationMs: number;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Event emitted when the worker encounters an unrecoverable or recoverable error.
 */
export interface SessionErrorEvent {
  type: 'session_error';
  /** Machine-readable error code (e.g. "LINKEDIN_AUTH_FAILED") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Whether the session can be retried after this error */
  recoverable: boolean;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Event emitted when a CAPTCHA is detected during automation.
 * The session will halt immediately on this event.
 */
export interface CaptchaDetectedEvent {
  type: 'captcha_detected';
  /** Platform-scoped unique identifier of the job being processed when CAPTCHA appeared */
  jobId: string;
  /** Platform where the CAPTCHA was detected */
  platform: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Discriminated union of all session event types.
 * Use the `type` field as the discriminant.
 */
export type SessionEventUnion =
  | SessionStartedEvent
  | JobFoundEvent
  | JobSkippedEvent
  | ApplicationMadeEvent
  | SessionCompleteEvent
  | SessionErrorEvent
  | CaptchaDetectedEvent;

/**
 * Persisted representation of a session event stored in MongoDB.
 * Events are stored in a ring buffer (max 100 via $push + $slice).
 */
export interface StoredSessionEvent {
  /** Monotonically increasing counter per session, starting at 1 */
  id: number;
  /** Discriminant matching the originating SessionEventUnion type */
  type: SessionEventUnion['type'];
  /** Full event payload serialised as a plain object */
  data: Record<string, unknown>;
  /** ISO 8601 timestamp (duplicated from data for fast index queries) */
  timestamp: string;
}
