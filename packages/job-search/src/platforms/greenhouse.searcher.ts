/**
 * Greenhouse Job Board Searcher
 *
 * Searches jobs from companies that use Greenhouse as their ATS via the
 * public Greenhouse Job Board API. No authentication required.
 *
 * API:
 *   GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
 *
 * Each job's `absolute_url` points to `boards.greenhouse.io/{company}/jobs/{id}`,
 * which is recognised by ats-detector.ts and applied via applyViaGreenhouse().
 *
 * After applying, the candidate can track all submissions at:
 *   https://my.greenhouse.io
 *
 * Config field: `search.greenhouseCompanies` — array of board tokens.
 * Example: ['stripe', 'figma', 'notion', 'airbnb']
 *
 * How to find a company's board token:
 *   Visit  https://boards.greenhouse.io/{company-name}
 *   If the page loads with job listings, that is the valid token.
 */

import type { AppConfig, JobListing } from '@job-agent/core';
import type { IPlatformSearcher } from '../interfaces/platform.interface.js';
import { fetchJson, sleep } from '../utils/http.js';
import { logger } from '../utils/logger.js';

// ── Greenhouse API types ───────────────────────────────────────────────────────

interface GhLocation {
  name: string;
}

interface GhJob {
  id: number;
  title: string;
  updated_at: string;
  location: GhLocation;
  /** Full URL to the job posting on boards.greenhouse.io */
  absolute_url: string;
  /** HTML job description — present when ?content=true */
  content?: string;
}

interface GhBoardResponse {
  jobs: GhJob[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Decodes common HTML entities (e.g. &lt; → <) before stripping tags. */
function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Strips HTML tags and normalises whitespace. */
function stripHtml(html: string): string {
  return decodeHtmlEntities(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Converts a board token (slug) to a display-ready company name.
 * Example: 'the-trade-desk' → 'The Trade Desk'
 */
function tokenToName(token: string): string {
  return token
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Infers work modality from the Greenhouse location string.
 * Greenhouse does not have a structured modality field.
 */
function inferModality(location: string): JobListing['modality'] {
  const lower = location.toLowerCase();
  if (lower.includes('remote') || lower.trim() === '') return 'Remote';
  if (lower.includes('hybrid') || lower.includes('flexible')) return 'Hybrid';
  return 'On-site';
}

/**
 * Returns true if the job TITLE matches at least one keyword.
 *
 * Greenhouse job descriptions almost always open with a generic company
 * introduction ("Figma is growing our team of engineers, designers…") that
 * would match developer keywords for every role regardless of actual function.
 * Restricting the match to the title avoids "Account Executive", "Legal
 * Counsel", and other non-tech roles from slipping through.
 */
function matchesKeywords(title: string, _description: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const titleLower = title.toLowerCase();
  return keywords.some((kw) => {
    const words = kw.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (words.length === 0) return titleLower.includes(kw.toLowerCase());
    // Use word boundaries so "engineer" does not match "engineering manager"
    return words.some((word) => {
      const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${safe}\\b`, 'i').test(titleLower);
    });
  });
}

// ── Default company list ──────────────────────────────────────────────────────

/**
 * Tech companies verified to use Greenhouse as their ATS.
 * Used when the user has not configured any companies explicitly.
 *
 * Companies are split into two tiers:
 *  • Standard boards (boards/job-boards.greenhouse.io) → auto-apply via API works
 *  • Custom portals  (company.com?gh_jid=...)          → jobs shown but apply is manual
 *
 * Dead boards (404) have been removed: notion, confluent, segment,
 * hashicorp, plaid, zendesk — these companies migrated away from Greenhouse.
 *
 * To add more companies visit https://boards.greenhouse.io/{token}.
 * If the absolute_url of a job contains "greenhouse.io", auto-apply works.
 */
const DEFAULT_GREENHOUSE_COMPANIES: string[] = [
  // ── Standard boards — auto-apply via Greenhouse API ────────────────────────
  'figma',        // ~176 open positions  (boards.greenhouse.io)
  'gusto',        // ~77  open positions  (job-boards.greenhouse.io)
  'postman',      // ~112 open positions  (job-boards.greenhouse.io)
  'amplitude',    // ~52  open positions  (job-boards.greenhouse.io)
  'twilio',       // ~133 open positions  (job-boards.greenhouse.io)
  'intercom',     // ~120 open positions  (job-boards.greenhouse.io)
  'mixpanel',     // ~40  open positions  (job-boards.greenhouse.io)
  'gitlab',       // ~175 open positions  (job-boards.greenhouse.io)
  'asana',        // standard board (unverified count)
  'discord',      // standard board (unverified count)
  'dropbox',      // standard board (unverified count)
  'webflow',      // standard board (unverified count)
  'loom',         // standard board (unverified count)

  // ── Custom portals — jobs listed but manual apply only ─────────────────────
  'stripe',       // stripe.com/jobs  (~900+ open positions)
  'brex',         // brex.com/careers (~102 open positions)
  'datadog',      // careers.datadoghq.com (~150+ open positions)
  'lattice',      // lattice.com/job  (~10  open positions)
  'cockroachlabs',// cockroachlabs.com/careers (~26 open positions)
];

// ── Searcher ──────────────────────────────────────────────────────────────────

/**
 * Greenhouse job searcher using the public Boards API.
 *
 * For each company board token in `config.search.greenhouseCompanies`
 * (or the built-in default list when none are configured), fetches all
 * open jobs and filters them client-side by keywords.
 *
 * Jobs whose apply URL matches boards.greenhouse.io are automatically
 * applied via applyViaGreenhouse() when the agent pipeline runs.
 */
export class GreenhouseSearcher implements IPlatformSearcher {
  readonly platformId = 'greenhouse' as const;

  /** @inheritdoc */
  async search(config: AppConfig, maxResults: number): Promise<JobListing[]> {
    const configured = config.search.greenhouseCompanies ?? [];
    const companies  = configured.length > 0 ? configured : DEFAULT_GREENHOUSE_COMPANIES;

    if (configured.length === 0) {
      logger.info(
        `[Greenhouse] No companies configured — using ${companies.length} defaults. ` +
        'Add greenhouseCompanies to config.yaml to customise.',
      );
    }

    const jobs: JobListing[] = [];
    const seenIds = new Set<string>();

    // Cap per-company to ensure variety across all configured boards.
    // Without this, a large board (e.g. Figma with 176 open roles) would
    // fill all slots before smaller boards are even fetched.
    const maxPerCompany = Math.max(3, Math.ceil(maxResults / Math.max(1, companies.length)));

    for (const boardToken of companies) {
      if (jobs.length >= maxResults) break;

      const url =
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;

      logger.info(`[Greenhouse] Fetching board: ${boardToken}`);

      let response: GhBoardResponse;
      try {
        response = await fetchJson<GhBoardResponse>(url, { Accept: 'application/json' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('404')) {
          logger.warn(
            `[Greenhouse] Board not found: "${boardToken}". ` +
            `Verify the token at https://boards.greenhouse.io/${boardToken}`,
          );
        } else {
          logger.warn(`[Greenhouse] Failed to fetch "${boardToken}": ${msg}`);
        }
        continue;
      }

      const boardJobs = response.jobs ?? [];
      logger.info(`[Greenhouse] "${boardToken}": ${boardJobs.length} open positions`);

      const companyName = tokenToName(boardToken);
      let companyCount = 0;

      for (const item of boardJobs) {
        if (jobs.length >= maxResults) break;
        if (companyCount >= maxPerCompany) break;

        const idStr = `gh_${item.id}`;
        if (seenIds.has(idStr)) continue;

        const title = item.title?.trim() ?? '';
        if (!title) continue;

        const descriptionHtml = item.content ?? '';
        const description = stripHtml(descriptionHtml).slice(0, 800);

        // Keyword filter — loose match against title + description text
        if (!matchesKeywords(title, description, config.search.keywords)) continue;

        seenIds.add(idStr);
        companyCount++;

        const locationStr = item.location?.name?.trim() ?? '';
        const modality    = inferModality(locationStr);

        const postedAt = item.updated_at
          ? new Date(item.updated_at).toISOString()
          : new Date().toISOString();

        jobs.push({
          id:                 idStr,
          title,
          company:            companyName,
          location:           locationStr || 'Remote',
          modality,
          description,
          requiredSkills:     [],
          postedAt,
          // Use the canonical boards URL only for companies that already serve their
          // job pages from greenhouse.io. Companies with custom portals (e.g. Stripe at
          // stripe.com/jobs/search?gh_jid=...) have the /applications API endpoint
          // disabled — keep the original URL so detectAts() returns null and we
          // skip the API call instead of getting a 404 "failed" error.
          applyUrl: /greenhouse\.io/i.test(item.absolute_url)
            ? `https://boards.greenhouse.io/${encodeURIComponent(boardToken)}/jobs/${item.id}`
            : item.absolute_url,
          hasEasyApply:       false,
          compatibilityScore: 0,
          platform:           'greenhouse',
        });
      }

      logger.info(`[Greenhouse] Collected ${jobs.length} jobs total after "${boardToken}"`);

      // Polite delay between company boards to avoid rate limiting
      if (companies.indexOf(boardToken) < companies.length - 1 && jobs.length < maxResults) {
        await sleep(800, 1500);
      }
    }

    const excluded = new Set(config.search.excludedCompanies.map((c) => c.toLowerCase()));
    const filtered = jobs.filter((j) => !excluded.has(j.company.toLowerCase()));

    logger.info(`[Greenhouse] Final result: ${filtered.length} jobs from ${companies.length} boards`);
    return filtered;
  }
}
