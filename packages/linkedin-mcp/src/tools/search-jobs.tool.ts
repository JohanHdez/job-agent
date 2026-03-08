import type { Page } from 'playwright';
import type { JobListing, AppConfig } from '@job-agent/core';
import { SELECTORS, LINKEDIN_URLS } from '../browser/selectors.constants.js';
import { SCROLL_DELAY } from '../utils/delay.js';
import { logger } from '../utils/logger.js';

/** LinkedIn date-posted filter URL parameter values */
const DATE_FILTER_MAP: Record<AppConfig['search']['datePosted'], string> = {
  past_24h: 'r86400',
  past_week: 'r604800',
  past_month: 'r2592000',
};

/** LinkedIn work modality filter URL parameter values */
const MODALITY_MAP: Record<string, string> = {
  Remote: '2',
  Hybrid: '3',
  'On-site': '1',
};

/**
 * Builds the LinkedIn job search URL with all filters applied.
 */
function buildSearchUrl(config: AppConfig): string {
  const params = new URLSearchParams();
  params.set('keywords', config.search.keywords.join(' OR '));
  params.set('location', config.search.location);
  params.set('f_TPR', DATE_FILTER_MAP[config.search.datePosted]);

  const modalityCodes = config.search.modality
    .map((m) => MODALITY_MAP[m])
    .filter(Boolean);
  if (modalityCodes.length > 0) {
    params.set('f_WT', modalityCodes.join(','));
  }

  return `${LINKEDIN_URLS.JOBS_SEARCH}?${params.toString()}`;
}

/** Shared type for the data extracted via page.evaluate */
interface RawJobData {
  id: string;
  title: string;
  company: string;
  location: string;
  postedAt: string;
  hasEasyApply: boolean;
  applyUrl: string;
}

/**
 * Extracts all job listings from the current page using page.evaluate().
 * This approach scans ALL anchor tags with /jobs/view/ in the href —
 * far more resilient to LinkedIn's frequent class-name changes.
 */
async function extractAllJobsFromPage(page: Page): Promise<RawJobData[]> {
  return page.evaluate((): RawJobData[] => {
    const results: RawJobData[] = [];

    // Strategy 1: data-job-id attribute (very stable across LinkedIn versions)
    const jobCards = Array.from(document.querySelectorAll('[data-job-id]'));

    for (const card of jobCards) {
      const id = card.getAttribute('data-job-id') ?? '';
      if (!id || !/^\d+$/.test(id)) continue;

      // Title: find the first anchor or heading inside the card
      const titleEl =
        card.querySelector('a[href*="/jobs/view/"]') ??
        card.querySelector('h3') ??
        card.querySelector('h2') ??
        card.querySelector('.job-card-list__title');

      const title = titleEl?.textContent?.trim() ?? '';
      if (!title) continue;

      // Company
      const companyEl =
        card.querySelector('[data-tracking-control-name="public_jobs_jserp-result_job-search-card-subtitle"]') ??
        card.querySelector('.artdeco-entity-lockup__subtitle') ??
        card.querySelector('.job-card-container__company-name') ??
        card.querySelector('h4') ??
        card.querySelector('.job-card-list__subtitle');
      const company = companyEl?.textContent?.trim() ?? 'Unknown';

      // Location
      const locationEl =
        card.querySelector('.artdeco-entity-lockup__caption') ??
        card.querySelector('.job-card-container__metadata-item') ??
        card.querySelector('.job-search-card__location');
      const location = locationEl?.textContent?.trim() ?? '';

      // Date
      const dateEl = card.querySelector('time');
      const postedAt = dateEl?.getAttribute('datetime') ?? new Date().toISOString();

      // Easy Apply — matches English "Easy Apply" and Spanish "Solicitud sencilla"
      const text = card.textContent ?? '';
      const hasEasyApply = /easy\s*apply|solicitud\s*sencilla/i.test(text);

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

    // Strategy 2: fallback — scan all job-view links if strategy 1 found nothing
    if (results.length === 0) {
      const seenIds = new Set<string>();
      const links = Array.from(document.querySelectorAll('a[href*="/jobs/view/"]'));

      for (const link of links) {
        const href = link.getAttribute('href') ?? '';
        const match = href.match(/\/jobs\/view\/(\d+)/);
        if (!match?.[1]) continue;

        const id = match[1];
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const title = link.textContent?.trim() ?? '';
        if (!title || title.length < 3) continue;

        // Walk up the DOM to find company/location siblings
        const card = link.closest('li') ?? link.closest('div[class*="job"]') ?? link.parentElement;
        const cardText = card?.textContent ?? '';

        results.push({
          id,
          title,
          company: 'Unknown',
          location: '',
          postedAt: new Date().toISOString(),
          hasEasyApply: /easy\s*apply|solicitud\s*sencilla/i.test(cardText),
          applyUrl: `https://www.linkedin.com/jobs/view/${id}/`,
        });
      }
    }

    return results;
  }) as Promise<RawJobData[]>;
}

/**
 * MCP Tool: search_jobs
 *
 * Navigates to LinkedIn job search, applies filters, scrolls through results,
 * and returns a list of JobListing objects.
 *
 * Uses a DOM-level extraction strategy based on data-job-id attributes and
 * href patterns — resistant to LinkedIn's frequent CSS class changes.
 *
 * @param page - Active Playwright page (logged-in LinkedIn session).
 * @param config - Application configuration with search filters.
 * @param maxResults - Maximum number of job listings to collect.
 * @returns Array of discovered job listings.
 */
export async function searchJobs(
  page: Page,
  config: AppConfig,
  maxResults = 50
): Promise<JobListing[]> {
  const url = buildSearchUrl(config);
  logger.info(`Navigating to job search: ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // Extra wait for dynamic content to render
  await new Promise((r) => setTimeout(r, 3_000));

  const seenIds = new Set<string>();
  const jobs: JobListing[] = [];
  let scrollAttempts = 0;
  const maxScrollAttempts = Math.ceil(maxResults / 10) + 2;

  while (jobs.length < maxResults && scrollAttempts < maxScrollAttempts) {
    // Check for CAPTCHA / challenge
    const challengeEl = await page.$(SELECTORS.CAPTCHA_CONTAINER).catch(() => null);
    if (challengeEl) {
      logger.error('CAPTCHA detected during search. Stopping.');
      break;
    }

    // Extract jobs visible on page
    const rawJobs = await extractAllJobsFromPage(page);
    logger.debug(`Extracted ${rawJobs.length} raw job entries from DOM`);

    for (const raw of rawJobs) {
      if (jobs.length >= maxResults) break;
      if (seenIds.has(raw.id)) continue;
      seenIds.add(raw.id);

      const locationText = raw.location;
      let modality: JobListing['modality'] = 'On-site';
      if (/remote|remoto|à distance|fernarbeit/i.test(locationText)) modality = 'Remote';
      else if (/hybrid|híbrido|hybride|teletrabajo parcial/i.test(locationText)) modality = 'Hybrid';

      // Deduplicate title text (LinkedIn sometimes renders it twice in the DOM)
      const rawTitle = raw.title;
      const halfLen = Math.floor(rawTitle.length / 2);
      const title =
        rawTitle.slice(0, halfLen) === rawTitle.slice(halfLen)
          ? rawTitle.slice(0, halfLen).trim()
          : rawTitle.trim();

      jobs.push({
        id: raw.id,
        title,
        company: raw.company,
        location: locationText,
        modality,
        description: '',
        requiredSkills: [],
        postedAt: raw.postedAt,
        applyUrl: raw.applyUrl,
        hasEasyApply: raw.hasEasyApply,
        compatibilityScore: 0,
        platform: 'linkedin',
      });

      logger.debug(`Found: ${raw.title} @ ${raw.company} [${raw.id}]`);
    }

    logger.info(`Collected ${jobs.length} jobs. Scrolling for more... (attempt ${scrollAttempts + 1})`);

    // Scroll down
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await SCROLL_DELAY();

    // Try "Load more" button (stable aria-label)
    const loadMoreBtn = page.locator(SELECTORS.LOAD_MORE_BUTTON).first();
    if (await loadMoreBtn.isVisible().catch(() => false)) {
      await loadMoreBtn.click().catch(() => {});
      await new Promise((r) => setTimeout(r, 2_000));
    }

    // Also try button with "See more jobs" text
    const seeMoreBtn = page.locator('button:has-text("See more jobs"), button:has-text("Mostrar más empleos")').first();
    if (await seeMoreBtn.isVisible().catch(() => false)) {
      await seeMoreBtn.click().catch(() => {});
      await new Promise((r) => setTimeout(r, 2_000));
    }

    scrollAttempts++;
  }

  // Filter excluded companies
  const excluded = new Set(config.search.excludedCompanies.map((c) => c.toLowerCase()));
  const filtered = jobs.filter((j) => !excluded.has(j.company.toLowerCase()));

  logger.info(`Search complete. Found ${jobs.length} jobs, after exclusions: ${filtered.length}`);
  return filtered;
}
