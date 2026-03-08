/**
 * Greenhouse Playwright Apply Handler
 *
 * Fills and submits the standard Greenhouse application web form using
 * browser automation. This is used as a fallback when the public REST
 * API endpoint (`/boards/{token}/jobs/{id}/applications`) is disabled
 * by the company (most large companies like Figma, Stripe disable it).
 *
 * Form URL: https://boards.greenhouse.io/{board_token}/jobs/{job_id}/apply
 *
 * Standard Greenhouse fields handled:
 *   first_name, last_name, email, phone, resume (file), cover_letter,
 *   LinkedIn URL, website URL.
 *
 * Any required custom questions that cannot be auto-filled will cause
 * the handler to return { status: 'api_disabled' } so the job is marked
 * as manual-apply rather than crashing the pipeline.
 */

import path from 'path';
import { chromium } from 'playwright';
import type { AppConfig, JobListing, ProfessionalProfile } from '@job-agent/core';
import { generateCoverLetter } from '../cover-letter.js';
import { logger } from '../utils/logger.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GreenhousePlaywrightStatus = 'applied' | 'already_applied' | 'api_disabled';

export interface GreenhousePlaywrightResult {
  status: GreenhousePlaywrightStatus;
  confirmationId?: string;
}

export interface GreenhousePlaywrightParams {
  boardToken: string;
  jobId: string;
  profile: ProfessionalProfile;
  job: JobListing;
  cvPath: string;
  config: AppConfig;
}

// ── Selectors ─────────────────────────────────────────────────────────────────

const SELECTORS = {
  firstName:      '#first_name',
  lastName:       '#last_name',
  email:          '#email',
  phone:          '#phone',
  resumeInput:    'input[type="file"][name*="resume"], input[type="file"]#resume, #resume',
  coverLetter:    '#cover_letter_text, textarea[name*="cover"], #cover_letter',
  linkedinUrl:    'input[name="website_addresses[][url]"][placeholder*="inked"], input[placeholder*="LinkedIn"]',
  submitButton:   'input[type="submit"], button[type="submit"], [data-submits="true"]',
  // Success indicators
  confirmationPage: '.confirmation, .application-confirmation, h1:has-text("Application submitted"), h1:has-text("Thank you")',
  alreadyApplied:   '.already-applied, [class*="already"], h1:has-text("already applied")',
  // Error indicators — required fields left unfilled
  requiredError:    '.field_with_errors, .error, [class*="error"]',
};

// ── Main handler ──────────────────────────────────────────────────────────────

/**
 * Applies to a Greenhouse job by filling the web form via Playwright.
 *
 * @returns { status, confirmationId? } or throws on unexpected errors.
 */
export async function applyViaGreenhousePlaywright(
  params: GreenhousePlaywrightParams,
): Promise<GreenhousePlaywrightResult> {
  const { boardToken, jobId, profile, job, cvPath, config } = params;

  const applyUrl = `https://boards.greenhouse.io/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}/apply`;
  logger.info(`[Greenhouse-PW] Opening form: ${applyUrl}`);

  const headless = process.env['HEADLESS'] !== 'false';
  const browser  = await chromium.launch({ headless, slowMo: headless ? 0 : 50 });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // ── Already applied? ────────────────────────────────────────────────────
    const alreadyText = await page.textContent('body').catch(() => '');
    if (
      alreadyText?.toLowerCase().includes('already applied') ||
      alreadyText?.toLowerCase().includes('ya solicitaste')
    ) {
      logger.info(`[Greenhouse-PW] Already applied to ${job.title} at ${job.company}`);
      return { status: 'already_applied' };
    }

    // ── Fill standard fields ────────────────────────────────────────────────
    const nameParts = profile.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? '';
    const lastName  = nameParts.slice(1).join(' ') || firstName;

    await fillIfExists(page, SELECTORS.firstName,  firstName);
    await fillIfExists(page, SELECTORS.lastName,   lastName);
    await fillIfExists(page, SELECTORS.email,      profile.email);
    if (profile.phone) {
      await fillIfExists(page, SELECTORS.phone, profile.phone);
    }

    // ── Upload CV ───────────────────────────────────────────────────────────
    const resumeInput = page.locator(SELECTORS.resumeInput).first();
    if (await resumeInput.count() > 0) {
      await resumeInput.setInputFiles(path.resolve(cvPath));
      logger.info(`[Greenhouse-PW] CV uploaded: ${path.basename(cvPath)}`);
    } else {
      logger.warn(`[Greenhouse-PW] No resume input found on form — skipping upload`);
    }

    // ── Cover letter ────────────────────────────────────────────────────────
    const clInput = page.locator(SELECTORS.coverLetter).first();
    if (await clInput.count() > 0) {
      const coverLetter = generateCoverLetter(profile, job, config);
      await clInput.fill(coverLetter);
    }

    // ── LinkedIn URL ────────────────────────────────────────────────────────
    if (profile.linkedinUrl) {
      const liInput = page.locator(SELECTORS.linkedinUrl).first();
      if (await liInput.count() > 0) {
        await liInput.fill(profile.linkedinUrl);
      }
    }

    // ── Fill custom fields from applicationDefaults ──────────────────────────
    const appDefaults = config.applicationDefaults;
    if (appDefaults) {
      await fillCustomFields(page, appDefaults);
    }

    // ── Check for unfilled required fields before submitting ────────────────
    // Greenhouse marks required custom questions with asterisks. If there are
    // visible empty required inputs that we haven't filled, bail out gracefully
    // rather than submitting a broken form.
    const emptyRequired = await page.evaluate(() => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input[required]:not([type="file"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), ' +
          'select[required], textarea[required]',
        ),
      );
      return inputs.some((el) => !el.value.trim());
    });

    if (emptyRequired) {
      logger.info(
        `[Greenhouse-PW] Form has required custom fields that cannot be auto-filled ` +
        `for "${job.title}" at ${job.company}. Marking as manual apply.`,
      );
      return { status: 'api_disabled' };
    }

    // ── Submit ──────────────────────────────────────────────────────────────
    const submitBtn = page.locator(SELECTORS.submitButton).first();
    if (await submitBtn.count() === 0) {
      logger.warn(`[Greenhouse-PW] Submit button not found for ${job.title}`);
      return { status: 'api_disabled' };
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => null),
      submitBtn.click(),
    ]);

    // ── Detect success ──────────────────────────────────────────────────────
    const finalUrl  = page.url();
    const bodyText  = (await page.textContent('body').catch(() => '')) ?? '';
    const bodyLower = bodyText.toLowerCase();

    const succeeded =
      finalUrl.includes('confirmation') ||
      finalUrl.includes('thank') ||
      bodyLower.includes('application submitted') ||
      bodyLower.includes('thank you for applying') ||
      bodyLower.includes('gracias por postularte') ||
      bodyLower.includes('successfully submitted') ||
      // Some Greenhouse boards redirect back to the job page on success
      (finalUrl.includes('/jobs/') && !finalUrl.includes('/apply'));

    if (succeeded) {
      logger.info(`[Greenhouse-PW] ✓ Applied to ${job.title} at ${job.company}`);
      return { status: 'applied' };
    }

    // If still on the apply page with errors, return api_disabled (manual apply)
    logger.warn(
      `[Greenhouse-PW] Could not confirm submission for ${job.title} at ${job.company}. ` +
      `URL after submit: ${finalUrl}`,
    );
    return { status: 'api_disabled' };

  } finally {
    await browser.close();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fills an input if the selector exists on the page, otherwise no-ops. */
async function fillIfExists(page: import('playwright').Page, selector: string, value: string): Promise<void> {
  try {
    const el = page.locator(selector).first();
    if (await el.count() > 0) {
      await el.fill(value);
    }
  } catch {
    // Ignore — field might not be present or visible
  }
}

/**
 * Fills common custom questions in Greenhouse application forms using
 * the candidate's configured applicationDefaults.
 *
 * Handles:
 *  - Radio groups: work authorization, visa sponsorship, relocation (Yes/No)
 *  - Text inputs: salary, notice period, GitHub, portfolio, years-of-experience
 *  - Dropdowns: "How did you hear about us?"
 */
async function fillCustomFields(
  page: import('playwright').Page,
  defaults: NonNullable<AppConfig['applicationDefaults']>,
): Promise<void> {
  // ── Radio groups ─────────────────────────────────────────────────────────
  // Collect unique radio group names and their surrounding question text
  type RadioGroup = { name: string; questionText: string };
  const radioGroups: RadioGroup[] = await page.evaluate((): RadioGroup[] => {
    const seen = new Set<string>();
    const groups: RadioGroup[] = [];
    for (const radio of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'))) {
      const name = radio.getAttribute('name') ?? '';
      if (!name || seen.has(name)) continue;
      seen.add(name);

      // Walk up to find the question label (legend, span, h3/h4, or label)
      let node: Element | null = radio.parentElement;
      let questionText = '';
      for (let i = 0; i < 7 && node; i++) {
        const legend = node.querySelector('legend');
        const span   = node.querySelector('.application-label, span[class*="label"], span[class*="title"]');
        const h      = node.querySelector('h3, h4, h5');
        const lbl    = node.querySelector('label:not([for])');
        const text   = (legend ?? span ?? h ?? lbl)?.textContent?.trim() ?? '';
        if (text.length > 4) { questionText = text.slice(0, 300); break; }
        node = node.parentElement;
      }
      groups.push({ name, questionText });
    }
    return groups;
  });

  for (const { name, questionText } of radioGroups) {
    const q = questionText.toLowerCase();
    let targetLabel: string | null = null;

    if (/author|eligible|legal.*work|right.*work|permit.*work/i.test(q)) {
      targetLabel = defaults.authorizedToWork !== false ? 'Yes' : 'No';
    } else if (/sponsor|visa\s*status|visa\s*support|immigration/i.test(q)) {
      targetLabel = defaults.requiresSponsorship ? 'Yes' : 'No';
    } else if (/relocat/i.test(q)) {
      targetLabel = defaults.willingToRelocate ? 'Yes' : 'No';
    }

    if (!targetLabel) continue;

    // Escape for CSS attribute selector
    const safeAttr   = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const groupRadios = page.locator(`input[type="radio"][name="${safeAttr}"]`);
    const groupCount  = await groupRadios.count();

    // Skip already-answered groups
    let anyChecked = false;
    for (let i = 0; i < groupCount; i++) {
      if (await groupRadios.nth(i).isChecked().catch(() => false)) { anyChecked = true; break; }
    }
    if (anyChecked) continue;

    let clicked = false;
    for (let i = 0; i < groupCount; i++) {
      const radio  = groupRadios.nth(i);
      const id     = await radio.getAttribute('id').catch(() => null);
      const lbl    = id
        ? (await page.locator(`label[for="${id}"]`).textContent().catch(() => '')) ?? ''
        : (await radio.getAttribute('value').catch(() => '')) ?? '';
      if (lbl.trim().toLowerCase() === targetLabel.toLowerCase()) {
        await radio.click().catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      await (targetLabel === 'No' ? groupRadios.last() : groupRadios.first()).click().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // ── Text inputs and textareas ─────────────────────────────────────────────
  const textInputs = page.locator(
    'input:not([type="radio"]):not([type="checkbox"]):not([type="file"])' +
    ':not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea',
  );
  const inputCount = await textInputs.count();

  for (let i = 0; i < inputCount; i++) {
    const inp = textInputs.nth(i);
    const currentVal = await inp.inputValue().catch(() => '');
    if (currentVal.trim()) continue;

    const id          = await inp.getAttribute('id').catch(() => null);
    const ariaLabel   = await inp.getAttribute('aria-label').catch(() => '') ?? '';
    const placeholder = await inp.getAttribute('placeholder').catch(() => '') ?? '';
    const labelText   = id
      ? (await page.locator(`label[for="${id}"]`).textContent().catch(() => '')) ?? ''
      : '';
    const combined = `${labelText} ${ariaLabel} ${placeholder}`.toLowerCase();

    let value = '';
    if (/salary|compensation|pay|wage|sueldo|salario|remuner/i.test(combined) && defaults.salaryExpectation) {
      value = defaults.salaryExpectation;
    } else if (/github/i.test(combined) && defaults.githubUrl) {
      value = defaults.githubUrl;
    } else if (/portfolio|personal.*site|website/i.test(combined) && defaults.portfolioUrl) {
      value = defaults.portfolioUrl;
    } else if (/notice|when.*start|available|start.*date/i.test(combined) && defaults.availableFrom) {
      value = defaults.availableFrom;
    } else if (/year.*exp|exp.*year|how.*long.*exp/i.test(combined) && defaults.yearsOfExperience !== undefined) {
      value = String(defaults.yearsOfExperience);
    }

    if (value) await inp.fill(value).catch(() => {});
  }

  // ── Dropdowns ─────────────────────────────────────────────────────────────
  if (defaults.howDidYouHear) {
    const selects = page.locator('select');
    const selCount = await selects.count();

    for (let i = 0; i < selCount; i++) {
      const sel = selects.nth(i);
      const currentVal = await sel.inputValue().catch(() => '');
      if (currentVal && currentVal !== '') continue;

      const id      = await sel.getAttribute('id').catch(() => null);
      const lblText = id
        ? (await page.locator(`label[for="${id}"]`).textContent().catch(() => '')) ?? ''
        : '';

      if (!/how.*hear|source|referr?|where.*find|how.*find/i.test(lblText)) continue;

      const options = await sel.locator('option').allTextContents();
      const target  = defaults.howDidYouHear;
      const match   = options.find((o) => o.toLowerCase().includes(target.toLowerCase()))
                   ?? options.find((o) => /other/i.test(o));
      if (match) await sel.selectOption({ label: match }).catch(() => {});
    }
  }
}
