import { test, expect } from '@playwright/test';
import { mockUnauthenticatedSession } from './helpers';

test.describe('LoginPage', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticatedSession(page);
    await page.goto('/login');
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  test('renders the LinkedIn sign-in button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Continue with LinkedIn/i })).toBeVisible();
  });

  test('renders the Google sign-in button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });

  test('renders the "Welcome back" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  });

  test('shows no error or session banner when no query params present', async ({ page }) => {
    await expect(page.getByRole('alert')).not.toBeVisible();
    await expect(page.getByRole('status')).not.toBeVisible();
  });

  // ── Session expired banner ───────────────────────────────────────────────

  test('shows session-expired amber banner for ?reason=session_expired', async ({ page }) => {
    await page.goto('/login?reason=session_expired');
    const banner = page.getByRole('status');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/session has expired/i);
  });

  test('session-expired page still shows both OAuth buttons', async ({ page }) => {
    await page.goto('/login?reason=session_expired');
    await expect(page.getByRole('button', { name: /Continue with LinkedIn/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });

  // ── Auth error banner ────────────────────────────────────────────────────

  test('shows red error banner for ?error=google_failed', async ({ page }) => {
    await page.goto('/login?error=google_failed');
    const banner = page.getByRole('alert');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/Google authentication failed/i);
  });

  test('shows red error banner for ?error=linkedin_failed', async ({ page }) => {
    await page.goto('/login?error=linkedin_failed');
    const banner = page.getByRole('alert');
    await expect(banner).toContainText(/LinkedIn authentication failed/i);
  });

  test('shows default error message for unknown error codes', async ({ page }) => {
    await page.goto('/login?error=unexpected_error_code');
    const banner = page.getByRole('alert');
    await expect(banner).toContainText(/unexpected error/i);
  });

  // ── OAuth button navigation ──────────────────────────────────────────────

  test('clicking LinkedIn button navigates to the API OAuth endpoint', async ({ page }) => {
    // Intercept the navigation triggered by the button click
    const navigationPromise = page.waitForURL(/auth\/linkedin/, { timeout: 5000 }).catch(() => null);
    await page.getByRole('button', { name: /Continue with LinkedIn/i }).click();
    // The button sets window.location.href — check the URL changed
    const url = page.url();
    // Either navigation started or we can check the href was set
    expect(url).toContain('linkedin');
    await navigationPromise;
  });
});
