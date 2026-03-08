/**
 * InfoJobs Job Searcher — uses HTTP fetch + HTML parsing.
 * No browser required.
 */

import type { AppConfig, JobListing } from '@job-agent/core';
import type { IPlatformSearcher } from '../interfaces/platform.interface.js';
import { fetchText, sleep } from '../utils/http.js';
import { logger } from '../utils/logger.js';

function buildUrl(config: AppConfig, page: number): string {
  const keyword  = encodeURIComponent(config.search.keywords.join(' '));
  const location = encodeURIComponent(config.search.location);
  return `https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=${keyword}&province=${location}&page=${page}`;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

interface RawJob {
  title: string;
  company: string;
  location: string;
  postedAt: string;
  applyUrl: string;
}

function parseHtml(html: string): RawJob[] {
  const results: RawJob[] = [];
  const seen = new Set<string>();

  // InfoJobs job links: /ofertas-trabajo/oferta-empleo-...
  const linkRegex = /<a[^>]+href="(\/ofertas-trabajo\/oferta-empleo[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(html)) !== null) {
    const href  = m[1] ?? '';
    const title = stripTags(m[2] ?? '').trim();
    if (!title || title.length < 4 || seen.has(href)) continue;
    seen.add(href);

    const applyUrl = `https://www.infojobs.net${href}`;
    const pos   = m.index;
    const block = html.slice(Math.max(0, pos - 300), pos + 600);

    const companyMatch = block.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/(?:span|a|p)>/i);
    const company = stripTags(companyMatch?.[1] ?? '').trim() || 'Unknown';

    const locationMatch = block.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p)>/i);
    const location = stripTags(locationMatch?.[1] ?? '').trim();

    results.push({ title, company, location, postedAt: new Date().toISOString(), applyUrl });
  }

  return results;
}

export class InfojobsSearcher implements IPlatformSearcher {
  readonly platformId = 'infojobs' as const;

  async search(config: AppConfig, maxResults: number): Promise<JobListing[]> {
    const seenUrls = new Set<string>();
    const jobs: JobListing[] = [];

    for (let page = 1; page <= 5 && jobs.length < maxResults; page++) {
      const url = buildUrl(config, page);
      logger.info(`[InfoJobs] Fetching page ${page}: ${url}`);

      let html: string;
      try {
        html = await fetchText(url, { 'Accept': 'text/html' });
      } catch (err) {
        logger.warn(`[InfoJobs] Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }

      const raw = parseHtml(html);
      if (raw.length === 0) break;

      for (const r of raw) {
        if (jobs.length >= maxResults) break;
        if (seenUrls.has(r.applyUrl)) continue;
        seenUrls.add(r.applyUrl);

        let modality: JobListing['modality'] = 'On-site';
        if (/remote|remoto|teletrabajo/i.test(r.location + r.title)) modality = 'Remote';
        else if (/hybrid|híbrido/i.test(r.location + r.title)) modality = 'Hybrid';

        const id = r.applyUrl.split('/').filter(Boolean).pop() ?? `ij_${Date.now()}`;

        jobs.push({
          id: `ij_${id}`,
          title: r.title,
          company: r.company,
          location: r.location,
          modality,
          description: '',
          requiredSkills: [],
          postedAt: r.postedAt,
          applyUrl: r.applyUrl,
          hasEasyApply: false,
          compatibilityScore: 0,
          platform: 'infojobs',
        });
      }

      logger.info(`[InfoJobs] Collected ${jobs.length} jobs`);
      if (page < 5 && jobs.length < maxResults) await sleep(2000, 3500);
    }

    const excluded = new Set(config.search.excludedCompanies.map((c) => c.toLowerCase()));
    return jobs.filter((j) => !excluded.has(j.company.toLowerCase()));
  }
}
