/**
 * Get on Board Job Searcher — uses the public categories REST API.
 *
 * Endpoint: https://www.getonbrd.com/api/v0/categories/programming/jobs
 * No authentication required.
 *
 * Attribute notes (verified from live API):
 *  - company   → JSON:API reference object — name is extracted from `projects` HTML
 *  - tags      → JSON:API reference array  — IDs only, not names (skipped)
 *  - published_at → Unix timestamp (seconds)
 *  - remote_modality → 'remote_local' | 'partial' | 'on_site'
 */

import type { AppConfig, JobListing } from '@job-agent/core';
import type { IPlatformSearcher } from '../interfaces/platform.interface.js';
import { fetchJson, sleep } from '../utils/http.js';
import { logger } from '../utils/logger.js';

// ── API response types ────────────────────────────────────────────────────────

interface GobAttributes {
  title?: string;
  description_headline?: string;
  description?: string;
  projects?: string;           // HTML — first sentence is usually the company blurb
  remote?: boolean;
  remote_modality?: string;    // 'remote_local' | 'partial' | 'on_site'
  published_at?: number;       // Unix timestamp (seconds)
  min_salary?: number;
  max_salary?: number;
  seniority?: unknown;         // JSON:API ref object — not usable as string
  tags?: unknown;              // JSON:API ref array  — IDs only
  company?: unknown;           // JSON:API ref object — IDs only
}

interface GobJob {
  id: string;
  type: string;
  attributes: GobAttributes;
  links?: { public_url?: string };
}

interface GobResponse {
  data?: GobJob[];
  meta?: { total_count?: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strips HTML tags and collapses whitespace. */
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Tries to extract the company name from the `projects` HTML field.
 * Get on Board typically opens the projects section with
 * "<Company> es una empresa..." or "<Company> is a/an..."
 */
function extractCompanyFromProjects(projectsHtml: string | undefined): string {
  if (!projectsHtml) return '';
  const text = stripHtml(projectsHtml);
  const m = text.match(/^([A-Za-záéíóúÁÉÍÓÚñÑ][^.]{2,70}?)\s+(?:es una|es un |is a |is an )/i);
  return m?.[1]?.trim() ?? '';
}

/**
 * Extracts the company name from the job ID slug as a fallback.
 *
 * Get on Board slugs follow: {job-title-words}-{company-words}-{location}
 * Strategy: remove the last segment (location), then find words in the
 * remaining slug that do NOT appear in the job title.
 */
function extractCompanyFromSlug(jobId: string, title: string): string {
  const titleWords = new Set(
    title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );

  const idParts = jobId.split('-').filter(Boolean);
  // Always remove the last segment — it's the location (remote/city/country)
  const parts = idParts.slice(0, -1);

  const companyParts: string[] = [];
  let foundCompany = false;

  for (const word of parts) {
    if (!titleWords.has(word) && word.length > 1) {
      companyParts.push(word);
      foundCompany = true;
    } else if (foundCompany) {
      break; // stop when we hit a title word again after the company
    }
  }

  if (companyParts.length === 0) return 'Unknown';
  return companyParts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Returns the best available company name for a job. */
function extractCompany(projectsHtml: string | undefined, jobId: string, title: string): string {
  return extractCompanyFromProjects(projectsHtml) || extractCompanyFromSlug(jobId, title);
}

/**
 * Checks if a job matches at least one of the search keywords.
 * For multi-word keywords, ANY significant word (>3 chars) is enough.
 * This avoids missing jobs when the full phrase doesn't appear verbatim.
 */
function matchesKeywords(title: string, headline: string, keywords: string[]): boolean {
  const text = `${title} ${headline}`.toLowerCase();
  return keywords.some((kw) => {
    const words = kw.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (words.length === 0) return text.includes(kw.toLowerCase());
    return words.some((word) => text.includes(word));
  });
}

// ── Searcher ──────────────────────────────────────────────────────────────────

/**
 * Get on Board job searcher using the public categories API.
 * Fetches the 'programming' category and filters by keywords client-side.
 */
export class GetonboardSearcher implements IPlatformSearcher {
  readonly platformId = 'getonboard' as const;

  /** @inheritdoc */
  async search(config: AppConfig, maxResults: number): Promise<JobListing[]> {
    const seenIds = new Set<string>();
    const jobs: JobListing[] = [];
    let page = 1;
    const maxPages = Math.ceil(maxResults / 25) + 2;

    while (jobs.length < maxResults && page <= maxPages) {
      const url = `https://www.getonbrd.com/api/v0/categories/programming/jobs?per_page=50&page=${page}`;
      logger.info(`[GetOnBoard] Fetching page ${page}: ${url}`);

      let response: GobResponse;
      try {
        response = await fetchJson<GobResponse>(url, {
          Accept: 'application/json',
          Referer: 'https://www.getonbrd.com/',
        });
      } catch (err) {
        logger.warn(`[GetOnBoard] Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }

      const items = response.data ?? [];
      if (items.length === 0) {
        logger.info('[GetOnBoard] No more results.');
        break;
      }

      for (const item of items) {
        if (jobs.length >= maxResults) break;
        if (seenIds.has(item.id)) continue;

        const attr   = item.attributes;
        const title  = attr.title?.trim() ?? '';
        if (!title) continue;

        // Loose keyword filter — let scorer handle ranking
        if (!matchesKeywords(title, attr.description_headline ?? '', config.search.keywords)) {
          continue;
        }

        seenIds.add(item.id);

        // Company name — from projects blurb, with slug fallback
        const company = extractCompany(attr.projects, item.id, title);

        // Modality
        let modality: JobListing['modality'] = 'On-site';
        if (attr.remote === true) modality = 'Remote';
        else if (attr.remote_modality === 'remote_local') modality = 'Remote';
        else if (attr.remote_modality === 'partial') modality = 'Hybrid';

        // Location string
        const location = modality === 'Remote' ? 'Remote' : '';

        // Published date — Unix timestamp (seconds)
        const postedAt = attr.published_at
          ? new Date(attr.published_at * 1000).toISOString()
          : new Date().toISOString();

        // Apply URL from links
        const applyUrl = item.links?.public_url
          ?? `https://www.getonbrd.com/jobs/${item.id}`;

        // Description — strip HTML
        const description = stripHtml(attr.description ?? attr.description_headline ?? '').slice(0, 500);

        jobs.push({
          id: `gob_${item.id}`,
          title,
          company,
          location,
          modality,
          description,
          requiredSkills: [],  // tags are ID-only references, not usable
          postedAt,
          applyUrl,
          hasEasyApply: false,
          compatibilityScore: 0,
          platform: 'getonboard',
        });
      }

      logger.info(`[GetOnBoard] Collected ${jobs.length} jobs after page ${page}`);
      page++;

      if (jobs.length < maxResults && page <= maxPages) {
        await sleep(1000, 2000);
      }
    }

    const excluded = new Set(config.search.excludedCompanies.map((c) => c.toLowerCase()));
    return jobs.filter((j) => !excluded.has(j.company.toLowerCase()));
  }
}
