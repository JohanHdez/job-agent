import type { Page } from 'playwright';
import type { JobListing } from '@job-agent/core';
import { SELECTORS, LINKEDIN_URLS } from '../browser/selectors.constants.js';
import { logger } from '../utils/logger.js';

/**
 * Common technical skill keywords for extracting required skills from job description.
 */
const SKILL_KEYWORDS = [
  'TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'Ruby', 'Kotlin', 'Swift',
  'React', 'Angular', 'Vue', 'Next.js', 'Nuxt', 'Svelte', 'Node.js', 'Express', 'NestJS',
  'FastAPI', 'Django', 'Flask', 'Spring Boot', 'Laravel', 'Rails',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra', 'DynamoDB', 'Elasticsearch',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform', 'Ansible',
  'Git', 'CI/CD', 'Jenkins', 'GitHub Actions', 'GitLab CI',
  'REST', 'GraphQL', 'gRPC', 'WebSockets', 'Kafka', 'RabbitMQ',
  'Linux', 'Microservices', 'Agile', 'Scrum',
];

/** Escapes all special regex metacharacters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, (ch) => `\\${ch}`);
}

/**
 * Extracts required skills from job description text by scanning for known keywords.
 */
function extractRequiredSkills(description: string): string[] {
  return SKILL_KEYWORDS.filter((skill) => {
    const escaped = escapeRegex(skill);
    const prefix = /^\w/.test(skill) ? '\\b' : '';
    const suffix = /\w$/.test(skill) ? '\\b' : '';
    return new RegExp(`${prefix}${escaped}${suffix}`, 'i').test(description);
  });
}

/**
 * MCP Tool: get_job_details
 *
 * Navigates to a specific LinkedIn job posting and extracts the full description
 * and required skills.
 *
 * @param page - Active Playwright page (logged-in LinkedIn session).
 * @param job - Partial job listing with at least an `id`.
 * @returns The job listing with `description` and `requiredSkills` populated.
 */
export async function getJobDetails(
  page: Page,
  job: JobListing
): Promise<JobListing> {
  const url = LINKEDIN_URLS.JOB_VIEW(job.id);
  logger.info(`Fetching job details for: ${job.title} [${job.id}]`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } catch (err) {
    logger.warn(`Navigation timeout for job ${job.id}, proceeding with partial load`);
  }

  try {
    // Wait for description to appear
    await page.waitForSelector(SELECTORS.JOB_DETAIL_DESCRIPTION, { timeout: 15_000 });

    const description =
      (await page.textContent(SELECTORS.JOB_DETAIL_DESCRIPTION)) ?? '';

    // Enrich modality from detail view if not already set
    const modalityText =
      (await page.textContent(SELECTORS.JOB_DETAIL_MODALITY).catch(() => null)) ?? '';
    let modality = job.modality;
    if (/remote/i.test(modalityText)) modality = 'Remote';
    else if (/hybrid/i.test(modalityText)) modality = 'Hybrid';
    else if (/on.site|onsite/i.test(modalityText)) modality = 'On-site';

    // Check if Easy Apply button is present
    const easyApplyBtn = page.locator(SELECTORS.EASY_APPLY_BUTTON).first();
    const hasEasyApply = await easyApplyBtn.isVisible().catch(() => false);

    const requiredSkills = extractRequiredSkills(description);

    logger.debug(
      `Job details fetched. Skills found: [${requiredSkills.join(', ')}]`
    );

    return {
      ...job,
      description: description.trim(),
      requiredSkills,
      modality,
      hasEasyApply,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to get details for job ${job.id}: ${message}`);
    return job;
  }
}
