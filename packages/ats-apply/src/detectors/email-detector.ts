/**
 * Email Apply Detector
 *
 * Scans a job description for a "apply-by-email" address.
 * Uses two passes:
 *  1. Context-aware: emails that appear on lines with apply/CV keywords (high confidence).
 *  2. Any email in the description as a fallback.
 *
 * Filters out no-reply, bounce, and generic system addresses.
 */

// ── Patterns ──────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Substrings that indicate a system / non-apply address.
 * Emails containing these are always skipped.
 */
const SKIP_SUBSTRINGS = [
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'mailer-daemon', 'bounce', 'unsubscribe',
  'example.com', 'example.org', 'test.com', 'domain.com',
  'privacy', 'gdpr', 'legal', 'abuse', 'spam',
];

/**
 * Keywords that, when found on the same line as an email, strongly
 * suggest it is the apply-to address.
 */
const APPLY_CONTEXT_KEYWORDS = [
  'apply', 'application', 'send', 'submit', 'cv', 'resume',
  'curriculum', 'solicitud', 'enviar', 'postulación', 'postular',
  'candidatura', 'contact us', 'reach out', 'email us',
];

/**
 * Substrings in the email's local part or domain that suggest it is
 * a recruiting / HR address (bonus scoring).
 */
const RECRUITING_HINTS = [
  'career', 'careers', 'job', 'jobs', 'hire', 'hiring',
  'recruit', 'hr', 'talent', 'people', 'team', 'apply',
  'empleo', 'trabajo', 'seleccion', 'rrhh',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSkippable(email: string): boolean {
  const lower = email.toLowerCase();
  return SKIP_SUBSTRINGS.some((s) => lower.includes(s));
}

function hasApplyContext(line: string): boolean {
  const lower = line.toLowerCase();
  return APPLY_CONTEXT_KEYWORDS.some((kw) => lower.includes(kw));
}

function hasRecruitingHint(email: string): boolean {
  const lower = email.toLowerCase();
  return RECRUITING_HINTS.some((hint) => lower.includes(hint));
}

// ── Main detector ─────────────────────────────────────────────────────────────

/**
 * Extracts the most likely "apply by email" address from a job description.
 *
 * Priority:
 *  1. Emails on a line that mentions apply / CV / send (with recruiting hint)
 *  2. Emails on a line that mentions apply / CV / send (without recruiting hint)
 *  3. Any email with a recruiting-flavoured address (e.g. jobs@, hr@)
 *  4. First valid email found anywhere in the description
 *
 * Returns `null` if no usable email is found.
 */
export function detectApplyEmail(description: string): string | null {
  if (!description || description.trim().length === 0) return null;

  // Bucket 1: context + recruiting hint
  // Bucket 2: context only
  // Bucket 3: recruiting hint only
  // Bucket 4: any valid email
  const buckets: [string[], string[], string[], string[]] = [[], [], [], []];

  const lines = description.split(/\n/);

  for (const line of lines) {
    const emails = [...(line.matchAll(EMAIL_REGEX))].map((m) => m[0]);
    for (const email of emails) {
      if (isSkippable(email)) continue;
      const ctx  = hasApplyContext(line);
      const hint = hasRecruitingHint(email);

      if (ctx && hint)   { buckets[0].push(email); continue; }
      if (ctx)           { buckets[1].push(email); continue; }
      if (hint)          { buckets[2].push(email); continue; }
      buckets[3].push(email);
    }
  }

  // Return first email from the highest-priority non-empty bucket
  for (const bucket of buckets) {
    if (bucket.length > 0) return bucket[0] ?? null;
  }

  return null;
}
