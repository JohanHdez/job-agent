import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { LinkedInCredentials } from '@job-agent/core';
import { SELECTORS, LINKEDIN_URLS } from './selectors.constants.js';
import { logger } from '../utils/logger.js';

/**
 * Manages a persistent LinkedIn browser session.
 * Handles login, CAPTCHA detection, and session lifecycle.
 */
export class LinkedInSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isLoggedIn = false;

  /**
   * Initializes the Playwright browser and navigates to LinkedIn.
   * @param credentials - LinkedIn email and password.
   * @param headless - Whether to run the browser in headless mode.
   * @param slowMo - Delay in ms between Playwright actions (human-like pacing).
   */
  async initialize(
    credentials: LinkedInCredentials,
    headless = false,
    slowMo = 50
  ): Promise<void> {
    logger.info('Launching Chromium browser...');

    this.browser = await chromium.launch({
      headless,
      slowMo,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });

    this.page = await this.context.newPage();
    await this.login(credentials);
  }

  /**
   * Performs the LinkedIn login flow.
   * @param credentials - LinkedIn email and password.
   */
  private async login(credentials: LinkedInCredentials): Promise<void> {
    if (!this.page) throw new Error('Browser page not initialized');

    logger.info('Navigating to LinkedIn login page...');
    await this.page.goto(LINKEDIN_URLS.LOGIN, { waitUntil: 'networkidle' });

    // Check if already logged in
    if (this.page.url().includes('/feed')) {
      logger.info('Already logged in (session cookie found)');
      this.isLoggedIn = true;
      return;
    }

    await this.page.fill(SELECTORS.LOGIN_EMAIL, credentials.email);
    await this.page.fill(SELECTORS.LOGIN_PASSWORD, credentials.password);
    await this.page.click(SELECTORS.LOGIN_SUBMIT);

    await this.page.waitForURL(/linkedin\.com\/feed|linkedin\.com\/checkpoint/, {
      timeout: 15_000,
    });

    // Check for CAPTCHA or unusual activity
    const captcha = await this.page.$(SELECTORS.CAPTCHA_CONTAINER);
    const unusualActivity = await this.page.$(SELECTORS.UNUSUAL_ACTIVITY_BANNER);

    if (captcha || unusualActivity) {
      logger.error('LinkedIn CAPTCHA or unusual activity detected. Stopping session.');
      throw new Error('LINKEDIN_CHALLENGE_DETECTED');
    }

    this.isLoggedIn = true;
    logger.info('Successfully logged in to LinkedIn');
  }

  /**
   * Returns the active Playwright page. Throws if not initialized.
   */
  getPage(): Page {
    if (!this.page) throw new Error('Session not initialized. Call initialize() first.');
    if (!this.isLoggedIn) throw new Error('Not logged in to LinkedIn.');
    return this.page;
  }

  /**
   * Checks if a CAPTCHA or unusual activity warning is present on the current page.
   * @returns true if a challenge is detected (agent should stop).
   */
  async checkForChallenge(): Promise<boolean> {
    if (!this.page) return false;

    const captcha = await this.page.$(SELECTORS.CAPTCHA_CONTAINER);
    const unusual = await this.page.$(SELECTORS.UNUSUAL_ACTIVITY_BANNER);

    if (captcha || unusual) {
      logger.warn('Challenge detected on page. Pausing to avoid account risk.');
      return true;
    }
    return false;
  }

  /**
   * Closes the browser and releases all resources.
   */
  async close(): Promise<void> {
    logger.info('Closing LinkedIn browser session...');
    await this.context?.close();
    await this.browser?.close();
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isLoggedIn = false;
  }
}
