import type { Page } from '@playwright/test';

const API_BASE = 'http://localhost:3001';

/** Stub user returned by GET /auth/me */
export const MOCK_USER = {
  id: 'e2e-user-1',
  email: 'e2e@example.com',
  name: 'E2E Test User',
  photo: null,
  headline: 'QA Engineer',
  providers: { linkedin: true, google: true },
};

/**
 * Intercepts POST /auth/refresh and returns a valid access token.
 * Simulates a user with a valid refresh token cookie.
 */
export async function mockAuthenticatedSession(page: Page): Promise<void> {
  await page.route(`${API_BASE}/auth/refresh`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'e2e-mock-access-token', expiresIn: 86400 }),
    });
  });

  await page.route(`${API_BASE}/auth/me`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_USER),
    });
  });
}

/**
 * Intercepts POST /auth/refresh and returns 401.
 * Simulates a user with no session (no cookie, or expired token).
 */
export async function mockUnauthenticatedSession(page: Page): Promise<void> {
  await page.route(`${API_BASE}/auth/refresh`, (route) => {
    void route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 401, message: 'No refresh token cookie' }),
    });
  });
}

/**
 * Intercepts GET /users/profile and returns a complete profile response.
 */
export async function mockCompleteProfile(page: Page): Promise<void> {
  await page.route(`${API_BASE}/users/profile`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          fullName: 'E2E Test User',
          skills: ['TypeScript', 'React'],
          seniority: 'Senior',
          experience: [{ company: 'ACME', title: 'Dev', startDate: '2020-01' }],
        },
        isComplete: true,
        missingFields: [],
      }),
    });
  });
}

/**
 * Intercepts GET /users/presets and returns an empty array.
 */
export async function mockEmptyPresets(page: Page): Promise<void> {
  await page.route(`${API_BASE}/users/presets`, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}
