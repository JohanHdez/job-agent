/**
 * ATS Detector — identifies which ATS a job URL points to and extracts
 * the identifiers required to call its application API.
 *
 * Supported platforms:
 *  - Greenhouse  boards.greenhouse.io / job-boards.greenhouse.io
 *  - Lever       jobs.lever.co
 */

import type { AtsMatch } from '../types.js';

// ── Greenhouse ────────────────────────────────────────────────────────────────
// URL formats:
//   https://boards.greenhouse.io/{board_token}/jobs/{job_id}
//   https://job-boards.greenhouse.io/{board_token}/jobs/{job_id}
//   https://boards.greenhouse.io/embed/job_app?token={job_id}&for={board_token}
const GREENHOUSE_PATTERNS: RegExp[] = [
  /(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i,
  /greenhouse\.io\/embed\/job_app.*?[?&]for=([^&]+).*?[?&]token=(\d+)/i,
  /greenhouse\.io\/embed\/job_app.*?[?&]token=(\d+).*?[?&]for=([^&]+)/i,
];

// ── Lever ─────────────────────────────────────────────────────────────────────
// URL format:
//   https://jobs.lever.co/{company}/{posting_uuid}
//   https://jobs.lever.co/{company}/{posting_uuid}/apply
const LEVER_PATTERN =
  /jobs\.lever\.co\/([^/?#]+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * Detects the ATS type from a job URL and extracts the identifiers
 * needed to call the application API.
 *
 * Returns `null` if the URL does not match any known ATS.
 */
export function detectAts(url: string): AtsMatch | null {
  // Greenhouse — try all URL patterns
  for (const pattern of GREENHOUSE_PATTERNS) {
    const m = url.match(pattern);
    if (m) {
      // embed URLs have swapped capture groups depending on param order — normalise
      const company = m[1]!;
      const jobId   = m[2]!;
      if (/^\d+$/.test(jobId)) {
        return { type: 'greenhouse', company, jobId };
      }
      // token came first in the embed variant
      if (/^\d+$/.test(company)) {
        return { type: 'greenhouse', company: jobId, jobId: company };
      }
    }
  }

  // Lever
  const lever = url.match(LEVER_PATTERN);
  if (lever) {
    return { type: 'lever', company: lever[1]!, jobId: lever[2]! };
  }

  return null;
}
