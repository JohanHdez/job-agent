/**
 * RemoteOK Job Searcher (replaces Indeed).
 *
 * RemoteOK exposes a free public JSON API — no auth, no browser required.
 * It aggregates remote tech jobs worldwide and is ideal for software engineers.
 *
 * API: https://remoteok.com/api?tags=TAG&location=LOCATION
 *
 * NOTE: This searcher is registered under the 'indeed' platformId so existing
 * configs that select 'indeed' automatically use this source.
 */

import type { AppConfig, JobListing } from '@job-agent/core';
import type { IPlatformSearcher } from '../interfaces/platform.interface.js';
import { fetchJson, sleep } from '../utils/http.js';
import { logger } from '../utils/logger.js';

/** Shape of a single job from RemoteOK's API. */
interface RemoteOkJob {
  id?: string;
  slug?: string;
  company?: string;
  position?: string;
  tags?: string[];
  location?: string;
  date?: string;
  url?: string;
  apply_url?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
}

/**
 * Builds the RemoteOK API URL.
 * Uses the unfiltered endpoint and filters client-side — RemoteOK's tag system
 * uses specific short tags (e.g. 'typescript', 'javascript') that don't match
 * natural-language keywords like "Software Engineer" directly.
 */
function buildUrl(): string {
  return 'https://remoteok.com/api';
}

/**
 * Returns true if a job matches at least one search keyword.
 * For multi-word keywords, ANY significant word (>3 chars) is enough to match.
 * This avoids missing jobs when the exact phrase doesn't appear in the title.
 */
function jobMatchesKeywords(position: string, tags: string[], keywords: string[]): boolean {
  const text = `${position} ${tags.join(' ')}`.toLowerCase();
  return keywords.some((kw) => {
    const words = kw.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    // No significant words → fall back to full phrase match
    if (words.length === 0) return text.includes(kw.toLowerCase());
    // Match if ANY significant word from the keyword appears in the job text
    return words.some((word) => text.includes(word));
  });
}

/**
 * RemoteOK job searcher (served under the 'indeed' platformId).
 * Uses the public RemoteOK JSON API — no login, no browser.
 */
export class IndeedSearcher implements IPlatformSearcher {
  readonly platformId = 'indeed' as const;

  /** @inheritdoc */
  async search(config: AppConfig, maxResults: number): Promise<JobListing[]> {
    logger.info(`[RemoteOK] Fetching all remote jobs (will filter by keywords client-side)...`);

    const url = buildUrl();
    let raw: unknown[];
    try {
      // RemoteOK returns an array; the first element is a legal/meta object, skip it
      raw = await fetchJson<unknown[]>(url, {
        Accept: 'application/json',
        Referer: 'https://remoteok.com/',
      });
    } catch (err) {
      logger.warn(`[RemoteOK] Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }

    // Skip the first element (it's a meta/attribution object, not a job)
    const jobsRaw = (Array.isArray(raw) ? raw.slice(1) : []) as RemoteOkJob[];
    logger.info(`[RemoteOK] API returned ${jobsRaw.length} total jobs, filtering by keywords...`);

    if (jobsRaw.length === 0) {
      logger.warn('[RemoteOK] API returned 0 jobs.');
      return [];
    }

    const seenIds = new Set<string>();
    const jobs: JobListing[] = [];

    for (const item of jobsRaw) {
      if (jobs.length >= maxResults) break;
      if (!item.position) continue;

      // Client-side keyword filter
      if (!jobMatchesKeywords(item.position, item.tags ?? [], config.search.keywords)) continue;

      const id = item.slug ?? item.id ?? `rok_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      // Location / modality
      const locationRaw = item.location ?? '';
      let modality: JobListing['modality'] = 'Remote'; // RemoteOK is remote-first
      if (/hybrid|híbrido/i.test(locationRaw)) modality = 'Hybrid';
      if (/on.?site|onsite|presencial/i.test(locationRaw)) modality = 'On-site';

      // Filter by user location preference if not fully remote
      const locationMatches =
        !config.search.location ||
        modality === 'Remote' ||
        locationRaw.toLowerCase().includes(config.search.location.toLowerCase());

      if (!locationMatches) continue;

      const applyUrl = item.apply_url ?? item.url ?? `https://remoteok.com/remote-jobs/${id}`;
      const description = (item.description ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 500);

      jobs.push({
        id: `rok_${id}`,
        title: item.position,
        company: item.company ?? 'Unknown',
        location: locationRaw || 'Remote',
        modality,
        description,
        requiredSkills: item.tags ?? [],
        postedAt: item.date ?? new Date().toISOString(),
        applyUrl,
        hasEasyApply: false,
        compatibilityScore: 0,
        platform: 'indeed',
      });
    }

    logger.info(`[RemoteOK] Collected ${jobs.length} jobs`);

    // RemoteOK is a single-page API — respect rate limit with a small delay
    await sleep(1000, 2000);

    const excluded = new Set(config.search.excludedCompanies.map((c) => c.toLowerCase()));
    return jobs.filter((j) => !excluded.has(j.company.toLowerCase()));
  }
}
