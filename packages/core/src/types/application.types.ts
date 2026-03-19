/**
 * Types for Phase 5 application lifecycle management.
 * These types power the email-based application workflow introduced in Phase 5.
 */

/**
 * Full lifecycle status for a Phase 5 SaaS application.
 *
 * State machine:
 *   draft → pending_review → sent → tracking_active → interview_scheduled | rejected
 *   draft → pending_review → rejected
 *   sent → offer_received | rejected
 */
export type ApplicationStatus =
  | 'draft'
  | 'pending_review'
  | 'sent'
  | 'tracking_active'
  | 'interview_scheduled'
  | 'offer_received'
  | 'rejected';

/**
 * A single entry in the application's audit trail.
 * Each status transition appends a new history entry.
 */
export interface ApplicationHistoryEntry {
  /** The status set at this transition */
  status: ApplicationStatus;
  /** ISO 8601 timestamp of the transition */
  timestamp: string;
  /** Optional human-readable note (e.g. rejection reason, interview notes) */
  note?: string;
}

/**
 * Email content generated for the application.
 * Produced by the EmailDraftAdapter and stored with the application document.
 */
export interface ApplicationEmailContent {
  /** Email subject line */
  subject: string;
  /** Email body in plain text or Markdown */
  body: string;
}

/**
 * Complete application document as stored in MongoDB.
 * One document per (userId, vacancyId) pair — enforced by unique index.
 */
export interface ApplicationDocumentType {
  /** MongoDB ObjectId string of the user who owns this application (NF-08) */
  userId: string;
  /** MongoDB ObjectId string of the vacancy being applied to */
  vacancyId: string;
  /** Current status in the application lifecycle */
  status: ApplicationStatus;
  /** Generated email content (subject + body) ready to send */
  emailContent: ApplicationEmailContent;
  /** Recipient email address extracted during vacancy persistence */
  recipientEmail: string;
  /** Ordered audit trail of all status transitions */
  history: ApplicationHistoryEntry[];
  /** ISO 8601 timestamp of document creation */
  createdAt: string;
  /** ISO 8601 timestamp of last document update */
  updatedAt: string;
}
