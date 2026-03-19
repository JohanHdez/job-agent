/**
 * JSearch (RapidAPI) job search adapter.
 *
 * Fetches job listings from the JSearch API and normalises them into
 * the RawJobResult contract defined in packages/core.
 *
 * Key behaviours:
 * - Maps job_publisher field to PlatformId (SRCH-03 requirement)
 * - Paginates until minResults collected or maxPages reached
 * - Returns partial results gracefully on API error
 * - Skips items missing required fields
 */

import type { JobSearchAdapter, SearchParams, RawJobResult, PlatformId } from '@job-agent/core';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import chalk = require('chalk');

const JSEARCH_BASE_URL = 'https://jsearch.p.rapidapi.com/search';

/** Maps datePosted config values to JSearch API date_posted param */
const DATE_POSTED_MAP: Record<string, string> = {
  past_24h: 'today',
  past_week: 'week',
  past_month: 'month',
};

/**
 * Maps JSearch job_publisher field to our PlatformId type.
 * JSearch aggregates results from multiple platforms (LinkedIn, Indeed, etc.)
 * and labels the source via the job_publisher field.
 */
const PUBLISHER_TO_PLATFORM: Record<string, PlatformId> = {
  linkedin: 'linkedin',
  indeed: 'indeed',
  computrabajo: 'computrabajo',
  bumeran: 'bumeran',
  getonboard: 'getonboard',
  infojobs: 'infojobs',
  greenhouse: 'greenhouse',
};

/**
 * Resolves a JSearch job_publisher string to a PlatformId.
 * Performs case-insensitive partial matching (e.g. "LinkedIn" -> 'linkedin').
 * Falls back to 'linkedin' for unrecognized publishers.
 */
function resolvePlatform(publisher: string | undefined): PlatformId {
  if (!publisher) return 'linkedin';
  const lower = publisher.toLowerCase().trim();
  for (const [key, platform] of Object.entries(PUBLISHER_TO_PLATFORM)) {
    if (lower.includes(key)) return platform;
  }
  return 'linkedin'; // Default fallback for unknown publishers
}

/** Shape of a single item returned by the JSearch API */
interface JSearchItem {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_description?: string;
  job_apply_link?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_posted_at_datetime_utc?: string;
  job_publisher?: string;
}

/** Shape of the JSearch API response body */
interface JSearchResponse {
  data?: JSearchItem[];
}

/**
 * JSearch (RapidAPI) job search adapter.
 * Fetches job listings from the JSearch API and maps them to RawJobResult[].
 * Maps the job_publisher field to the correct PlatformId (SRCH-03).
 */
export class JSearchAdapter implements JobSearchAdapter {
  readonly name = 'JSearch (RapidAPI)';
  /**
   * Default platform — note: JSearchAdapter returns results from multiple
   * platforms. Actual per-result platform comes from job_publisher field.
   */
  readonly platform: PlatformId = 'linkedin';

  private readonly apiKey: string;

  /** @param apiKey - RapidAPI application key for JSearch */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Searches JSearch API for jobs matching the given parameters.
   * Paginates until minResults collected or maxPages reached.
   *
   * @param params - Search parameters derived from the active session config
   * @returns Array of raw job results normalised to RawJobResult shape
   */
  async search(params: SearchParams): Promise<RawJobResult[]> {
    const location = params.location?.trim() || 'Remote';
    const isRemoteOnly = params.modality.length === 1 && params.modality[0] === 'Remote';

    // Build keyword candidates: primary first, then English fallbacks.
    // JSearch only supports English queries — non-English titles yield 0 results.
    const rawKeyword = params.keywords[0] ?? '';
    const keywordCandidates: string[] = rawKeyword ? [rawKeyword, 'Software Developer'] : ['Software Developer'];

    let results: RawJobResult[] = [];

    for (const keyword of keywordCandidates) {
      results = await this.fetchPages({ keyword, location, isRemoteOnly, datePosted: params.datePosted, minResults: params.minResults, maxPages: params.maxPages });
      if (results.length > 0) break;
      process.stdout.write(chalk.yellow(`[jsearch] 0 results for "${keyword}" — trying next keyword candidate\n`));
    }

    process.stdout.write(chalk.green(`[jsearch] Collected ${results.length} total results\n`));
    return results;
  }

  private async fetchPages(opts: {
    keyword: string;
    location: string;
    isRemoteOnly: boolean;
    datePosted: string;
    minResults: number;
    maxPages: number;
  }): Promise<RawJobResult[]> {
    const { keyword, location, isRemoteOnly, datePosted, minResults, maxPages } = opts;
    const results: RawJobResult[] = [];
    let page = 1;

    process.stdout.write(chalk.blue(`[jsearch] Searching: "${keyword}" in "${location}" remote_only=${isRemoteOnly}\n`));

    while (results.length < minResults && page <= maxPages) {
      const url = new URL(JSEARCH_BASE_URL);
      url.searchParams.set('query', `${keyword} in ${location}`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('num_pages', '1');
      url.searchParams.set('date_posted', DATE_POSTED_MAP[datePosted] ?? 'month');
      if (isRemoteOnly) url.searchParams.set('remote_jobs_only', 'true');

      process.stdout.write(chalk.blue(`[jsearch] Fetching page ${page}: ${url.toString()}\n`));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'jsearch.p.rapidapi.com',
          'x-rapidapi-key': this.apiKey,
        },
      });

      if (!response.ok) {
        process.stderr.write(chalk.red(`[jsearch] API error ${response.status}: ${response.statusText}\n`));
        break;
      }

      const body = (await response.json()) as JSearchResponse;
      const items = body.data ?? [];

      if (items.length === 0) {
        process.stdout.write(chalk.yellow(`[jsearch] Page ${page} returned 0 items (query: ${url.searchParams.get('query')})\n`));
        break;
      }

      for (const item of items) {
        if (!item.job_id || !item.job_title || !item.employer_name || !item.job_apply_link) continue;
        const locationParts = [item.job_city, item.job_state, item.job_country].filter(Boolean);
        results.push({
          jobId: item.job_id,
          title: item.job_title,
          company: item.employer_name,
          description: item.job_description ?? '',
          url: item.job_apply_link,
          location: locationParts.join(', ') || 'Unknown',
          platform: resolvePlatform(item.job_publisher),
          postedAt: item.job_posted_at_datetime_utc ?? new Date().toISOString(),
        });
      }

      page++;
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }

    return results;
  }
}
