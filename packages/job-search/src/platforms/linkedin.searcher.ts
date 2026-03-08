/**
 * LinkedIn Job Searcher — uses the public guest jobs API.
 *
 * LinkedIn exposes a guest endpoint that returns job cards as HTML fragments
 * without requiring authentication. This avoids opening any browser window.
 *
 * Endpoint: https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search
 */

import type { AppConfig, JobListing } from '@job-agent/core';
import type { IPlatformSearcher } from '../interfaces/platform.interface.js';
import { fetchText, sleep } from '../utils/http.js';
import { logger } from '../utils/logger.js';

/** LinkedIn date-posted filter values */
const DATE_FILTER_MAP: Record<AppConfig['search']['datePosted'], string> = {
  past_24h: 'r86400',
  past_week: 'r604800',
  past_month: 'r2592000',
};

/** LinkedIn work modality filter values */
const MODALITY_MAP: Record<string, string> = {
  Remote: '2',
  Hybrid: '3',
  'On-site': '1',
};

interface ParsedCard {
  id: string;
  title: string;
  company: string;
  location: string;
  postedAt: string;
  hasEasyApply: boolean;
  applyUrl: string;
}

/**
 * Builds the LinkedIn guest search API URL.
 * `start` is the pagination offset (0, 25, 50, …).
 */
function buildUrl(config: AppConfig, start: number): string {
  const params = new URLSearchParams();
  params.set('keywords', config.search.keywords.join(' '));
  params.set('location', config.search.location);
  params.set('f_TPR', DATE_FILTER_MAP[config.search.datePosted]);

  const codes = config.search.modality.map((m) => MODALITY_MAP[m]).filter(Boolean);
  if (codes.length > 0) params.set('f_WT', codes.join(','));

  params.set('start', String(start));

  return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
}

/**
 * Parses job cards from LinkedIn's guest API HTML fragment.
 * The response is a list of <li> elements, each containing a .base-search-card.
 */
function parseCards(html: string): ParsedCard[] {
  const results: ParsedCard[] = [];

  // Extract each <li> block
  const liMatches = html.match(/<li>[\s\S]*?<\/li>/g) ?? [];

  for (const li of liMatches) {
    // Job ID from data-entity-urn="urn:li:jobPosting:1234567890"
    const urnMatch = li.match(/data-entity-urn="[^"]*jobPosting:(\d+)"/);
    const id = urnMatch?.[1] ?? '';
    if (!id) continue;

    // Title from .base-search-card__title
    const titleMatch = li.match(/class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
    const title = stripTags(titleMatch?.[1] ?? '').trim();
    if (!title) continue;

    // Company from .base-search-card__subtitle
    const companyMatch = li.match(/class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/(?:h4|a|span)>/);
    const company = stripTags(companyMatch?.[1] ?? '').trim() || 'Unknown';

    // Location from .job-search-card__location
    const locationMatch = li.match(/class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const location = stripTags(locationMatch?.[1] ?? '').trim();

    // Posted date from <time datetime="...">
    const dateMatch = li.match(/<time[^>]+datetime="([^"]+)"/);
    const postedAt = dateMatch?.[1] ?? new Date().toISOString();

    // Easy Apply badge
    const hasEasyApply = /easy\s*apply|solicitud\s*sencilla/i.test(li);

    results.push({
      id,
      title,
      company,
      location,
      postedAt,
      hasEasyApply,
      applyUrl: `https://www.linkedin.com/jobs/view/${id}/`,
    });
  }

  return results;
}

/** Strips HTML tags from a string. */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * LinkedIn job searcher using the public guest jobs API.
 * No login, no browser — plain HTTP requests.
 */
export class LinkedInSearcher implements IPlatformSearcher {
  readonly platformId = 'linkedin' as const;

  /** @inheritdoc */
  async search(config: AppConfig, maxResults: number): Promise<JobListing[]> {
    const seenIds = new Set<string>();
    const jobs: JobListing[] = [];
    let start = 0;
    const pageSize = 25;
    const maxPages = Math.ceil(maxResults / pageSize) + 1;

    for (let page = 0; page < maxPages && jobs.length < maxResults; page++) {
      const url = buildUrl(config, start);
      logger.info(`[LinkedIn] Fetching page ${page + 1} (start=${start}): ${url}`);

      let html: string;
      try {
        html = await fetchText(url, {
          'Accept': 'text/html',
          'Referer': 'https://www.linkedin.com/',
          'X-Requested-With': 'XMLHttpRequest',
        });
      } catch (err) {
        logger.warn(`[LinkedIn] Page ${page + 1} fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }

      if (!html.trim() || html.trim() === '[]') {
        logger.info('[LinkedIn] No more results (empty response).');
        break;
      }

      const cards = parseCards(html);
      if (cards.length === 0) {
        logger.warn(`[LinkedIn] 0 cards parsed. Response preview: ${html.slice(0, 400).replace(/\n/g, ' ')}`);
        break;
      }

      for (const card of cards) {
        if (jobs.length >= maxResults) break;
        if (seenIds.has(card.id)) continue;
        seenIds.add(card.id);

        let modality: JobListing['modality'] = 'On-site';
        if (/remote|remoto/i.test(card.location)) modality = 'Remote';
        else if (/hybrid|híbrido/i.test(card.location)) modality = 'Hybrid';

        jobs.push({
          id: card.id,
          title: card.title,
          company: card.company,
          location: card.location,
          modality,
          description: '',
          requiredSkills: [],
          postedAt: card.postedAt,
          applyUrl: card.applyUrl,
          hasEasyApply: card.hasEasyApply,
          compatibilityScore: 0,
          platform: 'linkedin',
        });
      }

      logger.info(`[LinkedIn] Collected ${jobs.length} jobs so far`);
      start += pageSize;

      if (page < maxPages - 1 && jobs.length < maxResults) {
        await sleep(1500, 3000);
      }
    }

    const excluded = new Set(config.search.excludedCompanies.map((c) => c.toLowerCase()));
    return jobs.filter((j) => !excluded.has(j.company.toLowerCase()));
  }
}
