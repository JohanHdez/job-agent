/**
 * LinkedIn Agent — direct function interface for the CLI.
 *
 * This module exposes the same capabilities as the MCP server tools
 * but as plain async functions, suitable for import by the CLI orchestrator
 * without needing the MCP JSON-RPC protocol.
 */

import dotenv from 'dotenv';
import type {
  AppConfig,
  ProfessionalProfile,
  JobListing,
  ApplicationRecord,
} from '@job-agent/core';
import { LinkedInSession } from './browser/linkedin.session.js';
import { searchJobs } from './tools/search-jobs.tool.js';
import { getJobDetails } from './tools/get-job-details.tool.js';
import { easyApply } from './tools/easy-apply.tool.js';
import { rankJobs } from './scoring/job-matcher.js';
import { logger } from './utils/logger.js';

dotenv.config();

export interface AgentRunOptions {
  config: AppConfig;
  profile: ProfessionalProfile;
  maxResults?: number;
}

export interface AgentRunResult {
  jobs: JobListing[];
  applications: ApplicationRecord[];
}

/**
 * Runs the full LinkedIn search + apply pipeline.
 * Opens Chromium, logs in, searches for jobs, scores them, and applies.
 *
 * @param options - Search config, candidate profile, and optional limits.
 * @returns Discovered jobs and application records.
 */
export async function runLinkedInAgent(
  options: AgentRunOptions
): Promise<AgentRunResult> {
  const { config, profile, maxResults = 50 } = options;

  const email = process.env['LINKEDIN_EMAIL'] ?? '';
  const password = process.env['LINKEDIN_PASSWORD'] ?? '';

  if (!email || !password) {
    throw new Error(
      'LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in your .env file'
    );
  }

  const headless = process.env['HEADLESS'] !== 'false';
  const slowMo = parseInt(process.env['SLOW_MO'] ?? '50', 10);

  const session = new LinkedInSession();

  try {
    logger.info('Initializing LinkedIn session...');
    await session.initialize({ email, password }, headless, slowMo);

    const page = session.getPage();

    // ── Search jobs ───────────────────────────────────────────────
    logger.info('Searching for jobs...');
    const rawJobs = await searchJobs(page, config, maxResults);

    // ── Score & rank ──────────────────────────────────────────────
    logger.info(`Scoring ${rawJobs.length} jobs against profile...`);
    const scoredJobs = rankJobs(rawJobs, profile, 0);

    // ── Enrich details for top candidates ────────────────────────
    const minScore = config.matching.minScoreToApply;
    const maxApps = config.matching.maxApplicationsPerSession;
    const topJobs = scoredJobs.filter((j) => j.compatibilityScore >= minScore);
    logger.info(`${topJobs.length} jobs above score threshold (${minScore})`);

    const enriched: JobListing[] = [];
    for (const job of topJobs.slice(0, maxApps * 2)) {
      // Check for challenges before navigating
      if (await session.checkForChallenge()) {
        logger.error('Challenge detected. Stopping enrichment.');
        break;
      }
      const detailed = await getJobDetails(page, job);
      enriched.push(detailed);
    }

    // Merge enriched back with non-enriched
    const enrichedIds = new Set(enriched.map((j) => j.id));
    const allScoredJobs = [
      ...enriched,
      ...scoredJobs.filter((j) => !enrichedIds.has(j.id)),
    ];

    // ── Apply ─────────────────────────────────────────────────────
    const applications: ApplicationRecord[] = [];
    let appliedCount = 0;

    // Skipped (low score) records
    const skipped = scoredJobs
      .filter((j) => j.compatibilityScore < minScore)
      .map<ApplicationRecord>((j) => ({
        job: j,
        status: 'skipped_low_score',
        appliedAt: new Date().toISOString(),
      }));
    applications.push(...skipped);

    for (const job of enriched) {
      if (appliedCount >= maxApps) {
        logger.warn(`Reached max applications (${maxApps}). Stopping.`);
        break;
      }

      if (await session.checkForChallenge()) {
        logger.error('Challenge detected. Stopping applications.');
        break;
      }

      logger.info(
        `Applying: ${job.title} @ ${job.company} (score: ${job.compatibilityScore})`
      );

      const record = await easyApply(page, job, profile.phone);
      applications.push(record);

      if (record.status === 'applied') {
        appliedCount++;
        logger.info(`Applied! (${appliedCount}/${maxApps})`);
      }
    }

    return { jobs: allScoredJobs, applications };
  } finally {
    await session.close();
  }
}
