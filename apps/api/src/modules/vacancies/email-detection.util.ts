/**
 * Email detection utility for Phase 5 application automation.
 *
 * Detects recipient email addresses at vacancy persist time by checking:
 *   1. apply_options array for mailto: links (most reliable)
 *   2. Job description text via regex scan
 *   3. Falls back to 'manual_required' when no email is found
 *
 * Per CONTEXT.md locked decision: detection runs when a vacancy is persisted (insertMany).
 */
import type { EmailDetectionMethod } from '@job-agent/core';

/**
 * Result of the email detection attempt.
 */
interface EmailDetectionResult {
  /** Detected email address, or null if none found */
  email: string | null;
  /** How the email was found (or manual_required if not found) */
  method: EmailDetectionMethod;
}

/**
 * Shape of a single entry in the JSearch apply_options array.
 * Only the fields relevant for email detection are declared here.
 */
interface ApplyOption {
  publisher?: string;
  apply_link?: string;
  is_direct?: boolean;
}

/**
 * Email-local-part prefixes that indicate system/notification addresses
 * rather than actual application recipients.
 */
const IGNORED_PREFIXES = [
  'noreply',
  'no-reply',
  'info',
  'support',
  'hello',
  'contact',
  'admin',
  'webmaster',
  'mailer-daemon',
];

/**
 * Regex to match valid email addresses in free text.
 * Handles: user@domain.com, user.name@sub.domain.co.uk, user+tag@domain.com
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/**
 * Returns true when the email address looks like an actual application contact
 * (not a system/notification address).
 *
 * @param email - The email address to evaluate
 * @returns true when the email is suitable for applications
 */
function isApplicationEmail(email: string): boolean {
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  return !IGNORED_PREFIXES.some(prefix => local.startsWith(prefix));
}

/**
 * Detect the recipient email for a job application.
 *
 * Priority order:
 *   1. apply_options[].apply_link where the link starts with 'mailto:'
 *   2. First application-worthy email found in the job description text
 *   3. { email: null, method: 'manual_required' } when nothing is found
 *
 * @param applyOptions - JSearch apply_options array (may be undefined/empty)
 * @param jobDescription - Full job description text to scan for emails
 * @returns EmailDetectionResult with email and detection method
 */
export function detectRecipientEmail(
  applyOptions: ApplyOption[] | undefined,
  jobDescription: string
): EmailDetectionResult {
  // Step 1: Check apply_options for mailto: links
  if (applyOptions && applyOptions.length > 0) {
    for (const opt of applyOptions) {
      if (opt.apply_link && opt.apply_link.startsWith('mailto:')) {
        const email = opt.apply_link.replace('mailto:', '').split('?')[0]?.trim() ?? '';
        if (email && isApplicationEmail(email)) {
          return { email, method: 'apply_options' };
        }
      }
    }
  }

  // Step 2: Regex scan of job description
  const matches = jobDescription.match(EMAIL_REGEX) ?? [];
  for (const match of matches) {
    if (isApplicationEmail(match)) {
      return { email: match, method: 'jd_regex' };
    }
  }

  // Step 3: No email found — user must provide manually
  return { email: null, method: 'manual_required' };
}
