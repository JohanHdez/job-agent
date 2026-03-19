import type { ApplicationStatus } from '@job-agent/core';

/**
 * DTO for manual status updates on an existing application.
 * Only manual tracking states are accepted (sent/draft are system-managed).
 */
export class UpdateApplicationStatusDto {
  /**
   * New status to set — must be one of the manual tracking states:
   * 'tracking_active' | 'interview_scheduled' | 'offer_received' | 'rejected'
   */
  status!: ApplicationStatus;

  /** Optional note for this status transition (e.g. interview date, feedback) */
  note?: string;
}
