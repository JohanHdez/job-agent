/**
 * Computrabajo Job Searcher — uses HTTP fetch + HTML parsing.
 * No browser required.
 */

import type { AppConfig, JobListing } from '@job-agent/core';
import type { IPlatformSearcher } from '../interfaces/platform.interface.js';
import { fetchText, sleep } from '../utils/http.js';
import { logger } from '../utils/logger.js';

function buildUrl(config: AppConfig, page: number): string {
  const keyword  = encodeURIComponent(config.search.keywords.join(' '));
  const location = encodeURIComponent(config.search.location);
  const p = page > 1 ? `&p=${page}` : '';
  return `https://www.computrabajo.com/trabajo-de-${keyword}?q=${keyword}&l=${location}${p}`;
}

interface RawJob {
  id: string;
  title: string;
  company: string;
  location: string;
  postedAt: string;
  applyUrl: string;
}

/** Parses job listings from Computrabajo HTML response. */
function parseHtml(html: string): RawJob[] {
  const results: RawJob[] = [];

  // Computrabajo wraps each job in an article or box with data-id / data-code
  const articleBlocks = html.match(/<article[\s\S]*?<\/article>/gi) ?? [];

  for (const block of articleBlocks) {
    const idMatch  = block.match(/data-id="([^"]+)"|data-code="([^"]+)"/);
    const id       = idMatch?.[1] ?? idMatch?.[2] ?? '';

    const linkMatch  = block.match(/<a[^>]+href="([^"]*\/ofertas\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    const href       = linkMatch?.[1] ?? '';
    const title      = stripTags(linkMatch?.[2] ?? '').trim();
    if (!title) continue;

    const jobId  = id || (href.split('/').filter(Boolean).pop() ?? `ct_${Date.now()}`);
    const applyUrl = href.startsWith('http') ? href : `https://www.computrabajo.com${href}`;

    const companyMatch = block.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/(?:a|span|p|div)>/i);
    const company = stripTags(companyMatch?.[1] ?? '').trim() || 'Unknown';

    const locationMatch = block.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p|div)>/i);
    const location = stripTags(locationMatch?.[1] ?? '').trim();

    const dateMatch = block.match(/<time[^>]+datetime="([^"]+)"/) ??
                      block.match(/class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/(?:span|time|p)>/i);
    const postedAt = dateMatch?.[1]?.trim() ?? new Date().toISOString();

    results.push({ id: jobId, title, company, location, postedAt, applyUrl });
  }

  // Fallback: look for job links if no articles found
  if (results.length === 0) {
    const seen = new Set<string>();
    const linkRegex = /<a[^>]+href="([^"]*\/ofertas\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRegex.exec(html)) !== null) {
      const href  = m[1] ?? '';
      const title = stripTags(m[2] ?? '').trim();
      if (!title || title.length < 4 || seen.has(href)) continue;
      seen.add(href);
      const applyUrl = href.startsWith('http') ? href : `https://www.computrabajo.com${href}`;
      const jobId = href.split('/').filter(Boolean).pop() ?? `ct_${Date.now()}`;
      results.push({ id: jobId, title, company: 'Unknown', location: '', postedAt: new Date().toISOString(), applyUrl });
    }
  }

  return results;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export class ComputrabajoSearcher implements IPlatformSearcher {
  readonly platformId = 'computrabajo' as const;

  async search(config: AppConfig, maxResults: number): Promise<JobListing[]> {
    const seenIds = new Set<string>();
    const jobs: JobListing[] = [];

    for (let page = 1; page <= 5 && jobs.length < maxResults; page++) {
      const url = buildUrl(config, page);
      logger.info(`[Computrabajo] Fetching page ${page}: ${url}`);

      let html: string;
      try {
        html = await fetchText(url, { 'Accept': 'text/html' });
      } catch (err) {
        logger.warn(`[Computrabajo] Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }

      const raw = parseHtml(html);
      if (raw.length === 0) break;

      for (const r of raw) {
        if (jobs.length >= maxResults) break;
        if (seenIds.has(r.id)) continue;
        seenIds.add(r.id);

        let modality: JobListing['modality'] = 'On-site';
        if (/remote|remoto|teletrabajo/i.test(r.location + r.title)) modality = 'Remote';
        else if (/hybrid|híbrido/i.test(r.location + r.title)) modality = 'Hybrid';

        jobs.push({
          id: `ct_${r.id}`,
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
          platform: 'computrabajo',
        });
      }

      logger.info(`[Computrabajo] Collected ${jobs.length} jobs`);
      if (page < 5 && jobs.length < maxResults) await sleep(2000, 3500);
    }

    const excluded = new Set(config.search.excludedCompanies.map((c) => c.toLowerCase()));
    return jobs.filter((j) => !excluded.has(j.company.toLowerCase()));
  }
}
