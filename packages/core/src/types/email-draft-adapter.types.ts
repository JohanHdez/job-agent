/**
 * Adapter interface and supporting types for swappable email draft generation providers.
 * All email draft implementations (Claude API, template-based) must implement EmailDraftAdapter.
 *
 * Follows the same adapter pattern as ScoringAdapter in scoring-adapter.types.ts.
 */

import type { ProfessionalProfile } from './cv.types.js';

/**
 * Input required to generate a personalized application email draft.
 */
export interface EmailDraftInput {
  /** Applicant's professional profile (used for personalization) */
  profile: ProfessionalProfile;
  /** Full job description text */
  jobDescription: string;
  /** Job title being applied for */
  jobTitle: string;
  /** Company name (used in salutation and body) */
  company: string;
}

/**
 * Output produced by an email draft generator.
 * Contains the complete email ready for user review and dispatch.
 */
export interface EmailDraftOutput {
  /** Email subject line */
  subject: string;
  /** Email body in plain text or Markdown */
  body: string;
}

/**
 * Interface for swappable email draft generation providers.
 *
 * Implementations:
 * - ClaudeEmailDraftAdapter  — Claude claude-sonnet-4-6 via Anthropic API (personalized drafts)
 * - TemplateEmailDraftAdapter — static template-based fallback
 */
export interface EmailDraftAdapter {
  /** Human-readable name of the draft generator (e.g. "Claude claude-sonnet-4-6 Email Drafter") */
  readonly name: string;
  /**
   * Generate a personalized application email draft.
   *
   * @param input - Profile + job details for draft generation
   * @returns Email subject and body ready for user review
   */
  generateDraft(input: EmailDraftInput): Promise<EmailDraftOutput>;
}
