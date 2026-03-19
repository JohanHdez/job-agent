/**
 * @job-agent/ats-apply
 *
 * Orchestrates automated job applications via three channels:
 *   1. Greenhouse Job Board API
 *   2. Lever Postings API
 *   3. Email (SMTP via nodemailer) — when a "send CV to" address is found
 *      in the job description
 *
 * Usage:
 *   const result = await applyToAts({ job, profile, cvPath, config });
 *   if (result) {
 *     // result.status  → 'applied' | 'already_applied'
 *     // result.method  → 'greenhouse_api' | 'lever_api' | 'email'
 *   } else {
 *     // no supported channel detected — mark as manual
 *   }
 */

import type { AppConfig, ApplicationMethod, JobListing, ProfessionalProfile } from '@job-agent/core';
import { detectAts }                       from './detectors/ats-detector.js';
import { detectApplyEmail }                from './detectors/email-detector.js';
import { applyViaGreenhouse }              from './handlers/greenhouse.handler.js';
import { applyViaGreenhousePlaywright }    from './handlers/greenhouse-playwright.handler.js';
import { applyViaLever }                   from './handlers/lever.handler.js';
import { applyViaEmail }                   from './handlers/email.handler.js';
import { logger }                          from './utils/logger.js';

export { detectAts }          from './detectors/ats-detector.js';
export { detectApplyEmail }   from './detectors/email-detector.js';
export { generateCoverLetter } from './cover-letter.js';
export type { AtsMatch, AtsType } from './types.js';

// ── Main orchestrator ─────────────────────────────────────────────────────────

export interface ApplyToAtsParams {
  job:     JobListing;
  profile: ProfessionalProfile;
  /** Absolute path to the candidate's CV file (PDF or DOCX). */
  cvPath:  string;
  config:  AppConfig;
}

export interface ApplyToAtsResult {
  /** Whether the application was submitted or was a duplicate. */
  status: 'applied' | 'already_applied';
  /** Which API handled the submission. */
  method: ApplicationMethod;
  /**
   * Proof-of-submission identifier from the ATS or mail server.
   * Present when status === 'applied'.
   *   - Greenhouse → numeric application ID (e.g. "123456789")
   *   - Lever      → application UUID
   *   - Email      → SMTP message-id
   */
  confirmationId?: string;
}

/**
 * Detects the best application channel for a job and submits automatically.
 *
 * Priority:
 *   1. Greenhouse API  — URL matches boards.greenhouse.io / job-boards.greenhouse.io
 *   2. Lever API       — URL matches jobs.lever.co
 *   3. Email           — job description contains an apply-by-email address
 *                        AND SMTP_HOST is configured in the environment
 *
 * Returns `null` when no supported channel is detected, so the caller can
 * fall back to marking the job as "manual apply".
 *
 * Never throws — errors are caught, logged, and re-thrown with context.
 */
export async function applyToAts(
  params: ApplyToAtsParams,
): Promise<ApplyToAtsResult | null> {
  const { job, profile, cvPath, config } = params;

  // ── 1 & 2: Greenhouse / Lever ──────────────────────────────────────────────
  const ats = detectAts(job.applyUrl);
  if (ats) {
    logger.info(`[ATS] Detected ${ats.type} for "${job.title}" at ${job.company}`);
    try {
      switch (ats.type) {
        case 'greenhouse': {
          // ── Step 1: try the public REST API (fast, no browser needed) ──────
          const outcome = await applyViaGreenhouse({
            boardToken: ats.company,
            jobId:      ats.jobId,
            profile,
            job,
            cvPath,
            config,
          });

          if (outcome.status !== 'api_disabled') {
            // REST API worked (applied or already_applied)
            return {
              status: outcome.status,
              method: 'greenhouse_api',
              ...(outcome.confirmationId !== undefined ? { confirmationId: outcome.confirmationId } : {}),
            };
          }

          // ── Step 2: REST API disabled → fall back to Playwright form fill ──
          logger.info(
            `[ATS] Greenhouse REST API disabled for ${job.company} — ` +
            `falling back to Playwright form fill`,
          );
          const pwOutcome = await applyViaGreenhousePlaywright({
            boardToken: ats.company,
            jobId:      ats.jobId,
            profile,
            job,
            cvPath,
            config,
          });

          if (pwOutcome.status === 'api_disabled') {
            // Form has required custom fields we can't fill — mark as manual
            return null;
          }
          return {
            status: pwOutcome.status,
            method: 'greenhouse_api',
            ...(pwOutcome.confirmationId !== undefined ? { confirmationId: pwOutcome.confirmationId } : {}),
          };
        }

        case 'lever': {
          const outcome = await applyViaLever({
            company:   ats.company,
            postingId: ats.jobId,
            profile,
            job,
            cvPath,
            config,
          });
          return {
            status: outcome.status,
            method: 'lever_api',
            ...(outcome.confirmationId !== undefined ? { confirmationId: outcome.confirmationId } : {}),
          };
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[ATS] ${ats.type} apply failed for "${job.title}": ${msg}`);
      throw new Error(`[${ats.type}] ${msg}`);
    }
  }

  // ── 3: Email fallback ──────────────────────────────────────────────────────
  const smtpConfigured = Boolean(process.env['SMTP_HOST']);
  if (smtpConfigured) {
    const applyEmail = detectApplyEmail(job.description ?? '');
    if (applyEmail) {
      logger.info(`[Email] Found apply address "${applyEmail}" for "${job.title}"`);
      try {
        const outcome = await applyViaEmail({ toEmail: applyEmail, profile, job, cvPath, config });
        return {
          status: outcome.status,
          method: 'email',
          ...(outcome.confirmationId !== undefined ? { confirmationId: outcome.confirmationId } : {}),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[Email] Send failed for "${job.title}": ${msg}`);
        throw new Error(`[email] ${msg}`);
      }
    }
  } else {
    // Only scan description for email when SMTP is configured — avoids wasted work
    logger.info(`[ATS] SMTP not configured — skipping email channel for "${job.title}"`);
  }

  logger.info(`[ATS] No supported channel found for "${job.title}" at ${job.company}`);
  return null;
}
