---
status: testing
phase: 02-auth-+-users
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md
started: 2026-03-17T18:02:12Z
updated: 2026-03-17T18:02:12Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 3
name: Auth Code Exchange
expected: |
  After OAuth redirect, the frontend automatically POSTs `{ code: "<uuid>" }` to `POST /auth/exchange`. Response is HTTP 200 with `{ accessToken, expiresIn }` in the JSON body. Simultaneously, the browser receives a `Set-Cookie: refresh_token=...` header with `HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh`. You can verify the cookie in DevTools → Application → Cookies (it should NOT be readable via `document.cookie` in the browser console).
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. From the repo root, start the API: `npm run dev` or `cd apps/api && npx nest start`. The NestJS API boots without errors, logs show it listening on the configured API_PORT (default 3001), no TypeScript or module resolution errors appear in the console, and Redis connection is established (or gracefully skipped if Redis is not running locally).
result: pass

### 2. OAuth Redirect Has No Tokens in URL
expected: Initiate a LinkedIn or Google OAuth login from the frontend. When the OAuth callback fires and redirects back to the web app, the redirect URL should contain only `?code=<uuid>` — NO `accessToken`, `refreshToken`, or `token` query parameters in the URL. The browser history/address bar should never show a JWT.
result: pass

### 3. Auth Code Exchange
expected: After OAuth redirect, the frontend automatically POSTs `{ code: "<uuid>" }` to `POST /auth/exchange`. Response is HTTP 200 with `{ accessToken, expiresIn }` in the JSON body. Simultaneously, the browser receives a `Set-Cookie: refresh_token=...` header with `HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh`. You can verify the cookie in DevTools → Application → Cookies (it should NOT be readable via `document.cookie` in the browser console).
result: [pending]

### 4. Token Silent Refresh via Cookie
expected: Navigate to the app after having logged in previously (page load or hard refresh). The app should silently recover the session: it POSTs to `/auth/refresh` using the httpOnly cookie (no user action needed), gets a new access token, then fetches `/auth/me` to restore user state. You should land on the app already logged in without being redirected to a login screen.
result: [pending]

### 5. Logout Clears Auth Cookie
expected: While logged in, trigger logout (via logout button or `POST /auth/logout`). Response clears the `refresh_token` cookie (Set-Cookie with `Max-Age=0` or `Expires` in the past). After logout, attempting to call `POST /auth/refresh` returns HTTP 401 (no valid cookie to refresh with).
result: [pending]

### 6. GET /users/profile Returns Profile and Missing Fields
expected: While authenticated, call `GET /users/profile` (with Authorization Bearer header) or navigate to the Profile page. Response is HTTP 200 with the user's profile object. The response also includes a `missingFields` array listing any required profile fields not yet filled in (e.g., `["seniority", "skills"]` for a new user). An empty `missingFields: []` means the profile is complete.
result: [pending]

### 7. PATCH /users/profile Updates Profile
expected: While authenticated, submit a profile edit (via the ProfilePage edit form or `PATCH /users/profile` with a JSON body containing fields like `fullName`, `headline`, `location`). Response is HTTP 200 with the updated profile. A subsequent `GET /users/profile` returns the new values.
result: [pending]

### 8. Upload CV — Profile Merge with Fill-Empty-Only
expected: Upload a PDF CV via the ProfilePage CvDropzone or `POST /users/profile/cv` (multipart/form-data with a `cv` file field). The API parses the CV and merges extracted data into the profile. Critically: any fields you previously filled in manually should NOT be overwritten — only empty/null fields get populated from the CV. Response is HTTP 200 with the merged profile.
result: [pending]

### 9. Create Search Preset
expected: While authenticated, create a new search preset via ConfigPage or `POST /users/presets` with a JSON body (e.g., `{ name: "Remote TypeScript", keywords: ["TypeScript"], location: "Remote", ... }`). Response is HTTP 201 with the created preset including an `id`. The preset appears in the preset list.
result: [pending]

### 10. Set Active Preset
expected: With at least one preset created, activate it via ConfigPage or `PATCH /users/presets/active` with `{ presetId: "<id>" }`. Response is HTTP 200. A subsequent `GET /users/me` or `GET /users/presets` shows `activePresetId` matching the chosen preset.
result: [pending]

### 11. Delete Preset
expected: With at least one preset created, delete it via ConfigPage (Delete button with 5s confirmation window) or `DELETE /users/presets/:id`. Response is HTTP 200. The preset no longer appears in the preset list. Deleting a non-existent preset returns HTTP 404.
result: [pending]

### 12. 5-Preset Cap Enforcement
expected: Create 5 presets (or have 5 already). Attempt to create a 6th preset via `POST /users/presets`. Response is HTTP 400 Bad Request. In the ConfigPage UI, after 5 presets exist the "Save Preset" button is disabled or shows a "Maximum 5 presets reached." warning message.
result: [pending]

### 13. New User Routing to /profile/setup
expected: Log in with an account that has NO profile data (new account or cleared profile). After the OAuth code exchange completes in AuthCallbackPage, the app redirects to `/profile/setup` rather than `/config`. The ProfileSetupPage shows required fields: seniority pill-toggle, skills chip-input, and at least one work experience entry (company + title).
result: [pending]

### 14. ProfileSetupPage Save and Navigation
expected: On `/profile/setup`, fill in the required fields (pick a seniority level, add at least one skill, fill in a work experience). Click Save. The app calls `PATCH /users/profile` with the data and then redirects to `/config`. The profile is now saved — navigating to `/profile` shows the entered data.
result: [pending]

### 15. ProfilePage Edit Mode
expected: Navigate to the Profile page (`/profile`). Click the Edit button — an inline edit form appears with fields for fullName, headline, location, and summary pre-populated with current values. Make a change and click Save. The form calls `PATCH /users/profile`, collapses back to read mode, and displays the updated values. Clicking Discard cancels changes without saving.
result: [pending]

### 16. Incomplete Profile Amber Banner
expected: Navigate to the Profile page with a profile that has missing required fields. An amber/yellow banner (role="alert") appears between the page header and the profile content listing the missing fields (e.g., "Missing: seniority, skills"). When the profile is complete (all required fields filled), the banner should not be visible.
result: [pending]

### 17. ConfigPage Preset Management UI
expected: Navigate to `/config`. The preset management section shows the preset selector dropdown, a "Save Preset" button, and a list of existing presets each with Activate and Delete buttons. Saving creates a preset, activating highlights it as active, deleting shows a 5-second confirmation window before removing. All changes persist after page refresh.
result: [pending]

## Summary

total: 17
passed: 2
issues: 0
pending: 15
skipped: 0

## Gaps

[none yet]
