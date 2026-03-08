/**
 * @job-agent/job-search — Multi-platform Job Search Orchestrator
 *
 * Calls each platform searcher via plain HTTP (no browser, no Playwright).
 * All searches run in parallel and results are deduplicated by URL.
 */

import type { AppConfig, JobListing, PlatformId } from '@job-agent/core';
import type { IPlatformSearcher } from './interfaces/platform.interface.js';
import { LinkedInSearcher }    from './platforms/linkedin.searcher.js';
import { IndeedSearcher }       from './platforms/indeed.searcher.js';
import { ComputrabajoSearcher } from './platforms/computrabajo.searcher.js';
import { BumeranSearcher }      from './platforms/bumeran.searcher.js';
import { GetonboardSearcher }   from './platforms/getonboard.searcher.js';
import { InfojobsSearcher }     from './platforms/infojobs.searcher.js';
import { GreenhouseSearcher }   from './platforms/greenhouse.searcher.js';
import { logger } from './utils/logger.js';

/** Map of all available platform searcher implementations. */
const SEARCHER_MAP: Record<PlatformId, IPlatformSearcher> = {
  linkedin:     new LinkedInSearcher(),
  indeed:       new IndeedSearcher(),
  computrabajo: new ComputrabajoSearcher(),
  bumeran:      new BumeranSearcher(),
  getonboard:   new GetonboardSearcher(),
  infojobs:     new InfojobsSearcher(),
  greenhouse:   new GreenhouseSearcher(),
};

export type ProgressCallback = (message: string) => void;

/**
 * Runs a multi-platform job search using plain HTTP requests.
 * No browser is opened — all platforms are queried via API, RSS, or HTML fetch.
 *
 * @param config - Application config (search.platforms controls which are searched).
 * @param maxResultsPerPlatform - Max results to collect from each platform.
 * @param onProgress - Optional callback for real-time progress messages.
 * @returns Deduplicated array of JobListing objects from all platforms.
 */
export async function runMultiPlatformSearch(
  config: AppConfig,
  maxResultsPerPlatform = 25,
  onProgress?: ProgressCallback
): Promise<JobListing[]> {
  const selectedPlatforms: PlatformId[] = config.search.platforms ?? ['linkedin'];

  logger.info(`Starting HTTP-based search on: ${selectedPlatforms.join(', ')}`);
  onProgress?.(`Searching ${selectedPlatforms.length} platform(s): ${selectedPlatforms.join(', ')}`);

  const searchPromises = selectedPlatforms.map(async (platformId) => {
    const searcher = SEARCHER_MAP[platformId];
    if (!searcher) {
      logger.warn(`No searcher registered for platform: ${platformId}`);
      return [] as JobListing[];
    }

    try {
      onProgress?.(`[${platformId}] Searching...`);
      const jobs = await searcher.search(config, maxResultsPerPlatform);
      onProgress?.(`[${platformId}] Found ${jobs.length} jobs`);
      logger.info(`[${platformId}] Returned ${jobs.length} jobs`);
      return jobs;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[${platformId}] Search failed: ${msg}`);
      onProgress?.(`[${platformId}] Failed: ${msg}`);
      return [] as JobListing[];
    }
  });

  const results = await Promise.allSettled(searchPromises);
  const allJobs: JobListing[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allJobs.push(...result.value);
    }
  }

  // Deduplicate by applyUrl
  const seenUrls = new Set<string>();
  const deduped = allJobs.filter((job) => {
    if (seenUrls.has(job.applyUrl)) return false;
    seenUrls.add(job.applyUrl);
    return true;
  });

  logger.info(`Total jobs collected: ${allJobs.length}, after dedup: ${deduped.length}`);
  onProgress?.(`Total jobs found: ${deduped.length} (across ${selectedPlatforms.length} platforms)`);

  return deduped;
}

// Re-export types for consumers
export type { IPlatformSearcher };
export * from './interfaces/platform.interface.js';
