import { test, expect } from '@playwright/test';
import {
  mockAuthenticatedSession,
  mockUnauthenticatedSession,
  mockCompleteProfile,
  mockEmptyPresets,
} from './helpers';

// ── RequireAuth: protected routes redirect to /login when unauthenticated ────

test.describe('RequireAuth — unauthenticated access', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticatedSession(page);
  });

  test('unauthenticated user visiting /config is redirected to /login', async ({ page }) => {
    await page.goto('/config');
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated user visiting /profile is redirected to /login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated user visiting /history is redirected to /login', async ({ page }) => {
    await page.goto('/history');
    await expect(page).toHaveURL('/login');
  });

  test('/login is accessible when unauthenticated (no redirect loop)', async ({ page }) => {
    await page.goto('/login');
    // Should stay on /login, not redirect away
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('button', { name: /Continue with LinkedIn/i })).toBeVisible();
  });
});

// ── RequireGuest: /login redirects authenticated users to /config ──────────

test.describe('RequireGuest — authenticated user hits /login', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockCompleteProfile(page);
    await mockEmptyPresets(page);
  });

  test('authenticated user visiting /login is redirected to /config', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL('/config');
  });

  test('authenticated user does not see login buttons after redirect', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL('/config');
    await expect(page.getByRole('button', { name: /Continue with LinkedIn/i })).not.toBeVisible();
  });
});

// ── RequireAuth: authenticated users can access protected pages ──────────────

test.describe('RequireAuth — authenticated access', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockCompleteProfile(page);
    await mockEmptyPresets(page);
  });

  test('authenticated user can visit /config without being redirected', async ({ page }) => {
    await page.goto('/config');
    await expect(page).toHaveURL('/config');
  });
});

// ── Session expiry: redirect loop prevention ──────────────────────────────────

test.describe('Session expiry', () => {
  test('visiting /login?reason=session_expired with no cookie does not redirect loop', async ({ page }) => {
    await mockUnauthenticatedSession(page);

    await page.goto('/login?reason=session_expired');

    // Must stay on /login with the reason param, not redirect repeatedly
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('status')).toContainText(/session has expired/i);
  });
});
