/**
 * Lever Job Postings API — Application Handler
 *
 * Submits a job application via Lever's public postings API.
 * No authentication required — the company slug and posting UUID are
 * extracted from the job's apply URL.
 *
 * API reference:
 *   POST https://api.lever.co/v0/postings/{company}/{posting_id}/apply
 *
 * The endpoint accepts multipart/form-data with the candidate's details,
 * CV file, and an optional cover letter.
 */

import fs from 'fs/promises';
import path from 'path';
import type { AppConfig, JobListing, ProfessionalProfile } from '@job-agent/core';
import { generateCoverLetter } from '../cover-letter.js';
import { logger } from '../utils/logger.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeverErrorResponse {
  code?: string;
  message?: string;
}

interface LeverSuccessResponse {
  /** Lever returns the application UUID in one of these fields. */
  applicationId?: string;
  data?: { applicationId?: string; id?: string };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE  = 'https://api.lever.co/v0/postings';
const USER_AGENT = 'Mozilla/5.0 (compatible; JobAgent/2.0; +https://github.com/job-agent)';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the error body indicates a duplicate application. */
function isAlreadyApplied(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes('already applied') ||
    lower.includes('duplicate') ||
    lower.includes('existing application')
  );
}

// ── Main handler ──────────────────────────────────────────────────────────────

export interface LeverApplyParams {
  company:   string;
  postingId: string;
  profile:   ProfessionalProfile;
  job:       JobListing;
  cvPath:    string;
  config:    AppConfig;
}

export type LeverApplyStatus = 'applied' | 'already_applied';

export interface LeverApplyResult {
  status: LeverApplyStatus;
  /** Lever application UUID, present when status === 'applied'. */
  confirmationId?: string;
}

/**
 * Applies to a Lever-hosted job via the public postings API.
 *
 * @returns `{ status, confirmationId? }` — confirmationId is Lever's
 *          application UUID, usable as proof of submission.
 * @throws Error when the API returns a non-recoverable error.
 */
export async function applyViaLever(params: LeverApplyParams): Promise<LeverApplyResult> {
  const { company, postingId, profile, job, cvPath, config } = params;

  const apiUrl = `${API_BASE}/${encodeURIComponent(company)}/${encodeURIComponent(postingId)}/apply`;
  logger.info(`[Lever] Applying → ${job.title} at ${job.company} (company=${company}, posting=${postingId})`);

  // ── Build FormData payload ───────────────────────────────────────────────
  const form = new FormData();

  form.append('name',  profile.fullName);
  form.append('email', profile.email);
  if (profile.phone) form.append('phone', profile.phone);

  // Current organisation — optional but helpful
  const currentJob = (profile.experience ?? [])[0];
  if (currentJob?.company) form.append('org', currentJob.company);

  // Social / portfolio URLs
  if (profile.linkedinUrl) form.append('urls[LinkedIn]', profile.linkedinUrl);

  // CV attachment
  const cvBuffer = await fs.readFile(cvPath);
  const ext      = (path.extname(cvPath).slice(1) || 'pdf').toLowerCase();
  const mimeType = ext === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const cvFileName = `CV_${profile.fullName.replace(/\s+/g, '_')}.${ext}`;
  form.append('resume', new Blob([cvBuffer], { type: mimeType }), cvFileName);

  // Cover letter (plain text — Lever accepts this as the coverLetter field)
  const coverLetter = generateCoverLetter(profile, job, config);
  form.append('coverLetter', coverLetter);

  // Consent flag required by some Lever setups (GDPR)
  form.append('consent', 'true');

  // ── Submit ──────────────────────────────────────────────────────────────
  const response = await fetch(apiUrl, {
    method:  'POST',
    body:    form,
    headers: { 'User-Agent': USER_AGENT },
  });

  const bodyText = await response.text().catch(() => '');

  if (response.ok) {
    // Lever returns the applicationId in the response body
    let confirmationId: string | undefined;
    try {
      const parsed = JSON.parse(bodyText) as LeverSuccessResponse;
      confirmationId =
        parsed.applicationId ??
        parsed.data?.applicationId ??
        parsed.data?.id;
    } catch { /* body may not be JSON — continue without ID */ }

    logger.info(
      `[Lever] ✓ Applied to ${job.title} at ${job.company}` +
      (confirmationId ? ` — application ${confirmationId}` : ''),
    );
    return {
      status: 'applied',
      ...(confirmationId !== undefined ? { confirmationId } : {}),
    };
  }

  // 400 / 409 — duplicate detection
  if ((response.status === 400 || response.status === 409) && isAlreadyApplied(bodyText)) {
    logger.info(`[Lever] Already applied to ${job.title} at ${job.company}`);
    return { status: 'already_applied' };
  }

  // Parse error details
  let detail = bodyText.slice(0, 300);
  try {
    const parsed = JSON.parse(bodyText) as LeverErrorResponse;
    if (parsed.message) detail = parsed.message;
    else if (parsed.code) detail = `Error code: ${parsed.code}`;
  } catch { /* use raw bodyText */ }

  throw new Error(`Lever API ${response.status}: ${detail}`);
}
