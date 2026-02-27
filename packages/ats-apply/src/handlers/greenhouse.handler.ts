/**
 * Greenhouse Job Board API — Application Handler
 *
 * Submits a job application via Greenhouse's public Job Board API.
 * No authentication required — the board token (company slug) and
 * job ID are extracted from the job's apply URL.
 *
 * API reference:
 *   POST https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}/applications
 *
 * The endpoint accepts multipart/form-data with the candidate's details,
 * CV attachment, and an optional cover letter.
 */

import fs from 'fs/promises';
import path from 'path';
import type { AppConfig, JobListing, ProfessionalProfile } from '@job-agent/core';
import { generateCoverLetter } from '../cover-letter.js';
import { logger } from '../utils/logger.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GreenhouseError {
  message?: string;
}

interface GreenhouseErrorResponse {
  errors?: GreenhouseError[];
  message?: string;
}

interface GreenhouseSuccessResponse {
  /** Greenhouse assigns a unique numeric application ID on success. */
  id?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://boards-api.greenhouse.io/v1/boards';
const USER_AGENT = 'Mozilla/5.0 (compatible; JobAgent/2.0; +https://github.com/job-agent)';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Splits a full name into first and last name parts. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  const firstName = parts[0]!;
  const lastName  = parts.slice(1).join(' ');
  return { firstName, lastName };
}

/**
 * Parses a Greenhouse error response body and checks for "already applied"
 * indicators so the caller can set the correct ApplicationStatus.
 */
function isAlreadyApplied(responseBody: string): boolean {
  const lower = responseBody.toLowerCase();
  return (
    lower.includes('already applied') ||
    lower.includes('duplicate application') ||
    lower.includes('ya solicitaste')
  );
}

// ── Main handler ──────────────────────────────────────────────────────────────

export interface GreenhouseApplyParams {
  boardToken: string;
  jobId: string;
  profile: ProfessionalProfile;
  job: JobListing;
  cvPath: string;
  config: AppConfig;
}

export type GreenhouseApplyStatus = 'applied' | 'already_applied' | 'api_disabled';

export interface GreenhouseApplyResult {
  status: GreenhouseApplyStatus;
  /** Greenhouse numeric application ID, present when status === 'applied'. */
  confirmationId?: string;
}

/**
 * Applies to a Greenhouse-hosted job via the public Job Board API.
 *
 * @returns `{ status, confirmationId? }` — confirmationId is Greenhouse's
 *          numeric application ID, usable as proof of submission.
 * @throws Error when the API returns a non-recoverable error.
 */
export async function applyViaGreenhouse(
  params: GreenhouseApplyParams,
): Promise<GreenhouseApplyResult> {
  const { boardToken, jobId, profile, job, cvPath, config } = params;

  const apiUrl = `${API_BASE}/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}/applications`;
  logger.info(`[Greenhouse] Applying → ${job.title} at ${job.company} (board=${boardToken}, job=${jobId})`);

  // ── Build FormData payload ───────────────────────────────────────────────
  const { firstName, lastName } = splitName(profile.fullName);
  const form = new FormData();

  form.append('first_name', firstName);
  form.append('last_name',  lastName);
  form.append('email',      profile.email);
  if (profile.phone) form.append('phone', profile.phone);

  // CV attachment — read the file and wrap in a Blob
  const cvBuffer = await fs.readFile(cvPath);
  const ext      = (path.extname(cvPath).slice(1) || 'pdf').toLowerCase();
  const mimeType = ext === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const cvFileName = `CV_${profile.fullName.replace(/\s+/g, '_')}.${ext}`;
  form.append('resume', new Blob([cvBuffer], { type: mimeType }), cvFileName);

  // Cover letter (plain text)
  const coverLetter = generateCoverLetter(profile, job, config);
  form.append('cover_letter', coverLetter);

  // LinkedIn URL if available
  if (profile.linkedinUrl) {
    form.append('website_addresses[][url]',          profile.linkedinUrl);
    form.append('website_addresses[][website_type]', 'linkedin');
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  const response = await fetch(apiUrl, {
    method: 'POST',
    body:   form,
    headers: { 'User-Agent': USER_AGENT },
  });

  const bodyText = await response.text().catch(() => '');

  if (response.ok) {
    // Parse the application ID from the response body
    let confirmationId: string | undefined;
    try {
      const parsed = JSON.parse(bodyText) as GreenhouseSuccessResponse;
      if (parsed.id) confirmationId = String(parsed.id);
    } catch { /* body may not be JSON — continue without ID */ }

    logger.info(
      `[Greenhouse] ✓ Applied to ${job.title} at ${job.company}` +
      (confirmationId ? ` — application #${confirmationId}` : ''),
    );
    return {
      status: 'applied',
      ...(confirmationId !== undefined ? { confirmationId } : {}),
    };
  }

  // 4xx — check for "already applied" before throwing
  if (response.status === 422 && isAlreadyApplied(bodyText)) {
    logger.info(`[Greenhouse] Already applied to ${job.title} at ${job.company}`);
    return { status: 'already_applied' };
  }

  // 404 with HTML body → company has disabled the public applications API endpoint
  // (e.g. Stripe, Airbnb use custom portals). Not a real error — treat as unsupported.
  if (response.status === 404 && bodyText.trimStart().startsWith('<!DOCTYPE')) {
    logger.info(
      `[Greenhouse] API endpoint disabled for "${boardToken}" — company uses a custom portal. ` +
      `User should apply manually at ${job.applyUrl}`,
    );
    return { status: 'api_disabled' };
  }

  // Parse error details for a clearer message
  let detail = bodyText.slice(0, 300);
  try {
    const parsed = JSON.parse(bodyText) as GreenhouseErrorResponse;
    const msgs = (parsed.errors ?? []).map((e) => e.message).filter(Boolean);
    if (msgs.length > 0) detail = msgs.join('; ');
    else if (parsed.message) detail = parsed.message;
  } catch { /* use raw bodyText */ }

  throw new Error(`Greenhouse API ${response.status}: ${detail}`);
}
