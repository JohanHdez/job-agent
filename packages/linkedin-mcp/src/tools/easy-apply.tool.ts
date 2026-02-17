import type { Page } from 'playwright';
import type { JobListing, ApplicationRecord } from '@job-agent/core';
import { SELECTORS, LINKEDIN_URLS } from '../browser/selectors.constants.js';
import { APPLY_DELAY } from '../utils/delay.js';
import { logger } from '../utils/logger.js';

/** Maximum number of "Next" button clicks to prevent infinite loops */
const MAX_STEPS = 10;

/**
 * Attempts to fill text inputs in the Easy Apply form with provided answers.
 * Skips fields that are already filled.
 * Handles both English and Spanish aria-labels.
 */
async function fillTextInputs(page: Page, phoneNumber?: string): Promise<void> {
  const textInputs = page.locator(SELECTORS.EASY_APPLY_TEXT_INPUT);
  const count = await textInputs.count();

  for (let i = 0; i < count; i++) {
    const input = textInputs.nth(i);
    const label = await input.getAttribute('aria-label') ?? '';
    const placeholder = await input.getAttribute('placeholder') ?? '';
    const combined = `${label} ${placeholder}`;
    const value = await input.inputValue().catch(() => '');

    if (value.length > 0) continue; // already filled

    // Matches "phone", "tel", "mobile" (EN) and "teléfono", "número" (ES)
    if (/phone|tel|mobile|teléfono|telefono|número|numero/i.test(combined) && phoneNumber) {
      await input.fill(phoneNumber);
    }
  }
}

/**
 * Handles radio button groups in the Easy Apply form.
 *
 * - Resume step: if the PDF resume is available, selects it (first radio).
 * - Work permit / Yes-No questions: if no option is selected, picks the first one.
 *   (LinkedIn pre-fills "Yes" for most users, so this is a safety fallback.)
 */
async function fillRadioButtons(page: Page): Promise<void> {
  // Find all radio button groups (unique names)
  const radios = page.locator('input[type="radio"]');
  const count = await radios.count();
  if (count === 0) return;

  // Collect unique group names
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    const name = await radios.nth(i).getAttribute('name').catch(() => null);
    if (name) names.add(name);
  }

  for (const name of names) {
    const groupRadios = page.locator(`input[type="radio"][name="${name}"]`);
    const groupCount = await groupRadios.count();
    if (groupCount === 0) continue;

    // Check if any radio in this group is already selected
    let anyChecked = false;
    for (let i = 0; i < groupCount; i++) {
      const checked = await groupRadios.nth(i).isChecked().catch(() => false);
      if (checked) { anyChecked = true; break; }
    }

    // If nothing is checked, click the first option (safe default)
    if (!anyChecked) {
      await groupRadios.first().click().catch(() => {});
      await new Promise((r) => setTimeout(r, 300));
    }
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
  phoneNumber?: string
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
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

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
      await fillTextInputs(page, phoneNumber);

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
