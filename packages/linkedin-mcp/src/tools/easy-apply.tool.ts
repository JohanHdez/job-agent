import type { Page } from 'playwright';
import type { AppConfig, JobListing, ApplicationRecord } from '@job-agent/core';
import { SELECTORS, LINKEDIN_URLS } from '../browser/selectors.constants.js';
import { APPLY_DELAY } from '../utils/delay.js';
import { logger } from '../utils/logger.js';

/** Maximum number of "Next" button clicks to prevent infinite loops */
const MAX_STEPS = 10;

type AppDefaults = AppConfig['applicationDefaults'];

/**
 * Attempts to fill text inputs in the Easy Apply form.
 * Handles phone, salary, GitHub, portfolio, notice period, and years-of-experience.
 * Skips fields that are already filled.
 */
async function fillTextInputs(
  page: Page,
  phoneNumber?: string,
  defaults?: AppDefaults,
): Promise<void> {
  const textInputs = page.locator(SELECTORS.EASY_APPLY_TEXT_INPUT);
  const count = await textInputs.count();

  for (let i = 0; i < count; i++) {
    const input = textInputs.nth(i);
    const ariaLabel   = await input.getAttribute('aria-label').catch(() => '') ?? '';
    const placeholder = await input.getAttribute('placeholder').catch(() => '') ?? '';
    const combined    = `${ariaLabel} ${placeholder}`.toLowerCase();
    const value       = await input.inputValue().catch(() => '');

    if (value.length > 0) continue; // already filled

    if (/phone|tel|mobile|teléfono|telefono|número|numero/i.test(combined) && phoneNumber) {
      await input.fill(phoneNumber);
    } else if (defaults) {
      if (/salary|compensation|pay|wage|sueldo|salario/i.test(combined) && defaults.salaryExpectation) {
        await input.fill(defaults.salaryExpectation);
      } else if (/github/i.test(combined) && defaults.githubUrl) {
        await input.fill(defaults.githubUrl);
      } else if (/portfolio|personal.*site|website/i.test(combined) && defaults.portfolioUrl) {
        await input.fill(defaults.portfolioUrl);
      } else if (/notice|when.*start|available|start.*date/i.test(combined) && defaults.availableFrom) {
        await input.fill(defaults.availableFrom);
      } else if (/year.*exp|exp.*year|how.*long/i.test(combined) && defaults.yearsOfExperience !== undefined) {
        await input.fill(String(defaults.yearsOfExperience));
      }
    }
  }
}

/**
 * Handles radio button groups in the Easy Apply form.
 *
 * When `defaults` is provided, reads the surrounding question text for each
 * radio group and selects the correct option (Yes/No) based on the user's
 * configured answers for work authorization, sponsorship, and relocation.
 *
 * Falls back to clicking the first option for unrecognised questions.
 */
async function fillRadioButtons(page: Page, defaults?: AppDefaults): Promise<void> {
  const radios = page.locator('input[type="radio"]');
  const count  = await radios.count();
  if (count === 0) return;

  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    const name = await radios.nth(i).getAttribute('name').catch(() => null);
    if (name) names.add(name);
  }

  for (const name of names) {
    const safeAttr   = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const groupRadios = page.locator(`input[type="radio"][name="${safeAttr}"]`);
    const groupCount  = await groupRadios.count();
    if (groupCount === 0) continue;

    // Skip if already answered
    let anyChecked = false;
    for (let i = 0; i < groupCount; i++) {
      if (await groupRadios.nth(i).isChecked().catch(() => false)) {
        anyChecked = true;
        break;
      }
    }
    if (anyChecked) continue;

    // Determine what answer this question requires
    let targetLabel: string | null = null;

    if (defaults) {
      // Read the question text from the nearest legend, h3, or label-like element
      const questionText: string = await groupRadios.first().evaluate((el) => {
        let node: Element | null = el.parentElement;
        for (let i = 0; i < 6 && node; i++) {
          const legend = node.querySelector('legend');
          const span   = node.querySelector('span[class*="label"], span[class*="title"], .fb-form-element__label');
          const h      = node.querySelector('h3, h4');
          const lbl    = node.querySelector('label:not([for])');
          const text   = (legend ?? span ?? h ?? lbl)?.textContent?.trim() ?? '';
          if (text.length > 4) return text.slice(0, 300);
          node = node.parentElement;
        }
        return '';
      }).catch(() => '');

      const q = questionText.toLowerCase();

      if (/author|eligible|legal.*work|right.*work|permit.*work/i.test(q)) {
        targetLabel = defaults.authorizedToWork !== false ? 'Yes' : 'No';
      } else if (/sponsor|visa\s*status|visa\s*support|immigration/i.test(q)) {
        targetLabel = defaults.requiresSponsorship ? 'Yes' : 'No';
      } else if (/relocat/i.test(q)) {
        targetLabel = defaults.willingToRelocate ? 'Yes' : 'No';
      }
    }

    if (targetLabel) {
      // Try to match option label text exactly (case-insensitive)
      let clicked = false;
      for (let i = 0; i < groupCount; i++) {
        const radio    = groupRadios.nth(i);
        const id       = await radio.getAttribute('id').catch(() => null);
        const labelTxt = id
          ? (await page.locator(`label[for="${id}"]`).textContent().catch(() => '')) ?? ''
          : (await radio.getAttribute('value').catch(() => '')) ?? '';

        if (labelTxt.trim().toLowerCase() === targetLabel.toLowerCase()) {
          await radio.click().catch(() => {});
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        // Positional fallback: "No" → last option, "Yes" → first option
        await (targetLabel === 'No' ? groupRadios.last() : groupRadios.first())
          .click().catch(() => {});
      }
    } else {
      // No recognized question — click first option (safe default)
      await groupRadios.first().click().catch(() => {});
    }

    await new Promise((r) => setTimeout(r, 300));
  }
}

/**
 * Advances through one step of the Easy Apply modal.
 * Returns false when the flow is complete or an error is detected.
 */
async function advanceStep(page: Page): Promise<'next' | 'review' | 'submit' | 'done' | 'error'> {
  // Check for error messages
  const errorEl = page.locator(SELECTORS.EASY_APPLY_ERROR).first();
  if (await errorEl.isVisible().catch(() => false)) {
    return 'error';
  }

  // Check for success
  const successEl = page.locator(SELECTORS.EASY_APPLY_SUCCESS).first();
  if (await successEl.isVisible().catch(() => false)) {
    return 'done';
  }

  // Check for submit button (final step)
  const submitBtn = page.locator(SELECTORS.EASY_APPLY_SUBMIT_BUTTON).first();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click();
    return 'submit';
  }

  // Check for review button
  const reviewBtn = page.locator(SELECTORS.EASY_APPLY_REVIEW_BUTTON).first();
  if (await reviewBtn.isVisible().catch(() => false)) {
    await reviewBtn.click();
    return 'review';
  }

  // Next button
  const nextBtn = page.locator(SELECTORS.EASY_APPLY_NEXT_BUTTON).first();
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click();
    return 'next';
  }

  return 'done';
}

/**
 * MCP Tool: easy_apply
 *
 * Executes the LinkedIn Easy Apply flow for a given job listing.
 * Handles multi-step forms, fills required fields, and submits the application.
 *
 * Rate limit: waits 8-12 seconds after each submission (see APPLY_DELAY).
 *
 * @param page - Active Playwright page (logged-in LinkedIn session).
 * @param job - The job to apply to (must have hasEasyApply === true).
 * @param phoneNumber - Optional phone number to fill in application forms.
 * @returns ApplicationRecord with status and metadata.
 */
export async function easyApply(
  page: Page,
  job: JobListing,
  phoneNumber?: string,
  defaults?: AppDefaults,
): Promise<ApplicationRecord> {
  const appliedAt = new Date().toISOString();

  if (!job.hasEasyApply) {
    return {
      job,
      status: 'easy_apply_not_available',
      appliedAt,
    };
  }

  try {
    const url = LINKEDIN_URLS.JOB_VIEW(job.id);
    logger.info(`Navigating to job for Easy Apply: ${job.title} [${job.id}]`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Check if already applied (EN: "Applied", ES: "Solicitado")
    const alreadyApplied = await page
      .locator('button[aria-label*="Applied"], button[aria-label*="Solicitado"]')
      .isVisible()
      .catch(() => false);
    if (alreadyApplied) {
      logger.info(`Already applied to: ${job.title}`);
      return { job, status: 'already_applied', appliedAt };
    }

    // Click the Easy Apply button
    const easyApplyBtn = page.locator(SELECTORS.EASY_APPLY_BUTTON).first();
    const isVisible = await easyApplyBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!isVisible) {
      return { job, status: 'easy_apply_not_available', appliedAt };
    }

    await easyApplyBtn.click();

    // Wait for modal to appear
    await page.waitForSelector(SELECTORS.EASY_APPLY_MODAL, { timeout: 10_000 });

    // Multi-step form navigation
    let step = 0;
    let lastAction: string = '';

    while (step < MAX_STEPS) {
      await fillTextInputs(page, phoneNumber, defaults);
      await fillRadioButtons(page, defaults);

      const action = await advanceStep(page);
      logger.debug(`Easy Apply step ${step + 1}: action=${action}`);

      if (action === 'done' || (action === 'submit' && lastAction === 'submit')) {
        // Successful submission
        await APPLY_DELAY();
        logger.info(`Successfully applied to: ${job.title} @ ${job.company}`);
        return { job, status: 'applied', appliedAt };
      }

      if (action === 'error') {
        throw new Error('Easy Apply form validation error');
      }

      lastAction = action;
      step++;

      // Small pause between steps (human-like)
      await new Promise((r) => setTimeout(r, 1_000));
    }

    throw new Error('Easy Apply did not complete within maximum steps');

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Easy Apply failed for ${job.id}: ${errorMessage}`);

    // Try to close the modal to clean up
    const closeBtn = page.locator(SELECTORS.EASY_APPLY_CLOSE_BUTTON).first();
    await closeBtn.click().catch(() => {});

    return {
      job,
      status: 'failed',
      appliedAt,
      errorMessage,
    };
  }
}
