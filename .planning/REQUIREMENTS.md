# Requirements: Job Agent SaaS MVP

**Defined:** 2026-03-11
**Core Value:** The agent applies to compatible jobs on the user's behalf — so they never have to manually browse, filter, or fill application forms again.
**Source:** docs/JobAgent-Requerimientos-MVP-v1.1.docx (v1.1)

---

## v1 Requirements

### Authentication (AUTH)

- [x] **AUTH-01**: User can register and log in using LinkedIn OAuth 2.0 — access_token, refresh_token, and basic profile data stored; JWT issued with 24h expiry
- [x] **AUTH-02**: User can register and log in using Google OAuth 2.0 — email, name, and photo stored; JWT issued with 24h expiry
- [x] **AUTH-03**: All protected routes require a valid JWT; system supports automatic token refresh before expiry without re-login
- [x] **AUTH-04**: User can edit their name, contact email, and platform language preference; changes persist in MongoDB

### Navigation & UX (NAV)

- [ ] **NAV-01**: Authenticated user sees a persistent sidebar with: profile photo/avatar, "Search Jobs with AI", "Reports", and "Log Out"; sidebar is collapsible on mobile (RF-28)

### Profile (PROF)

- [x] **PROF-01**: System imports professional profile from LinkedIn API using OAuth token — work experience, education, skills, languages, location, headline → ProfessionalProfileType (RF-05)
- [x] **PROF-02**: User can upload a PDF CV; system parses it with Claude API and generates ProfessionalProfileType with >= 85% accuracy on critical fields (RF-06)
- [x] **PROF-03**: User can review imported profile in an editable form (skills, seniority, languages, experience) and save changes for use in future searches (RF-07)
- [x] **PROF-04**: If imported profile lacks critical fields (skills, minimum experience), system shows an alert with a list of missing fields and guidance to complete them (RF-08)

### Search Configuration (SRCH)

- [x] **SRCH-01**: User can configure search: keywords, location, modality (Remote/Hybrid/On-site), target platforms (LinkedIn, Indeed, Computrabajo), seniority, languages, date posted, min score, max applications, excluded companies; config persists in MongoDB and can be saved as a named preset (RF-09)
- [x] **SRCH-02**: User can save up to 5 named search presets and switch between them (RF-10)
- [ ] **SRCH-03**: User selects which platforms to search (LinkedIn Jobs, Indeed, Computrabajo); searches run in parallel; results are labeled by platform of origin (RF-11)

### Automation & Matching (AUTO)

- [ ] **AUTO-01**: Agent executes automated searches on LinkedIn Jobs, Indeed, and Computrabajo with configured filters using Playwright; returns minimum 20 results per active platform (when available); results deduplicated by URL (RF-12)
- [ ] **AUTO-02**: Every vacancy receives a compatibility score 0-100 comparing JD vs ProfessionalProfileType (skills match, seniority, language, modality, salary); vacancies sorted descending by score in the UI (RF-13)
- [ ] **AUTO-03**: System maintains a persistent MongoDB history of all vacancies seen/applied per user; vacancies with the same URL or (company + title) already in history are automatically excluded from new search results (RF-14)
- [ ] **AUTO-04**: Companies in the user's excludedCompanies list are filtered before displaying results or applying; excluded count visible in reports (RF-15)

### Applications (APPLY)

- [ ] **APPLY-01**: For LinkedIn vacancies with Easy Apply button, agent executes full multi-step form flow with submit; rate limiting 8-12s between applications; ApplicationRecord created with status=applied; CAPTCHA detected → pause and notify user (RF-16)
- [ ] **APPLY-02**: For vacancies requiring email application, system generates a personalized email using Claude API with subject "[Full Name] - [Role] @ [Company]"; sends via SMTP; registers with status=email_sent, emailSubject, emailBody, recipientEmail, timestamp in < 5s (RF-17)
- [ ] **APPLY-03**: Before sending email, user can preview the AI-generated draft, edit it, and approve or discard the send (active only in review mode) (RF-18)
- [ ] **APPLY-04**: Agent enforces maxApplicationsPerSession limit; counter visible during execution; agent stops and notifies user when limit reached (RF-19)

### History & Tracking (HIST)

- [ ] **HIST-01**: User can view a paginated (20/page) global history of all applications across all sessions, filterable by date, company, platform, and status; exportable to CSV (RF-20)
- [ ] **HIST-02**: Clicking an application in history shows: full JD, score, sent email (if applicable), link to vacancy, current status, and state change timeline (RF-21)
- [ ] **HIST-03**: User can manually update the status of an application (e.g., "interview scheduled", "offer received", "rejected"); change persists in MongoDB with timestamp (RF-22)
- [ ] **HIST-04**: User can mark a vacancy as "Not interested" to exclude it from future searches without applying; added to history with status=dismissed (RF-23)

### Reports (REPT)

- [ ] **REPT-01**: At the end of each session, system generates a report with total vacancies found/applied/skipped/failed, breakdown by platform and company, average score; available as HTML in dashboard and downloadable as Markdown; generated in < 10s (RF-24)
- [ ] **REPT-02**: Report includes a table of all emails sent in the session: company, role, recipient, subject, date, status (sent/failed); user can view full email body (RF-25)
- [ ] **REPT-03**: Dashboard shows aggregated historical metrics: total applications, response rate (user-reported), top platforms, top companies applied to; charts using recharts; date range filterable (RF-26)
- [ ] **REPT-04**: User can export any session report as CSV (data) or PDF (formatted report); PDF generated in < 15s (RF-27)

### Real-Time (RT)

- [ ] **RT-01**: Session search progress updates in real-time in the UI (jobs found, applications made) via SSE or WebSocket without manual polling (RNF-17)

### Non-Functional (NF)

- [ ] **NF-01**: Dashboard loads in < 2 seconds; Lighthouse Performance >= 85; LCP < 2.5s (RNF-01)
- [ ] **NF-02**: Compatibility scoring completes in < 500ms per vacancy; p95 < 500ms at 50 concurrent vacancies (RNF-02)
- [x] **NF-03**: LinkedIn profile import completes in < 8 seconds end-to-end (RNF-03)
- [ ] **NF-04**: Personalized email generation via Claude API in < 5 seconds; timeout at 8s; max 2 retries with backoff (RNF-04)
- [ ] **NF-05**: System supports 100 concurrent users running searches without degradation; p99 < 3s response time (RNF-07)
- [x] **NF-06**: OAuth tokens and credentials stored encrypted (AES-256-GCM) in MongoDB; never exposed in logs or API responses (RNF-08)
- [x] **NF-07**: All API routes require valid JWT signed with RS256, 24h expiry; unauthenticated requests return 401 (RNF-09) — HS256 in Phase 1; RS256 deferred to Phase 2
- [x] **NF-08**: Personal data (CV, history, email) accessible only by the owner user; row-level security on all MongoDB queries (RNF-10)
- [x] **NF-09**: Sensitive env vars (API keys, credentials) never committed to repo; CI/CD fails if secrets detected in code (RNF-11)
- [x] **NF-10**: Unit test coverage >= 70% on packages/shared/types and core NestJS modules; build fails below threshold (RNF-12)
- [x] **NF-11**: Zero TypeScript errors in strict mode; `any` prohibited throughout codebase; tsc --noEmit returns 0 errors in CI/CD (RNF-13)
- [x] **NF-12**: All NestJS modules use structured logging (Winston) with correlationId, userId, and ISO timestamp; no console.log in production (RNF-14)
- [x] **NF-13**: Backend exposes GET /health returning { status, uptime, version } in < 100ms (RNF-15)
- [ ] **NF-14**: Platform fully responsive (mobile-first) from 360px; sidebar collapsible on mobile (RNF-16)
- [ ] **NF-15**: All errors show clear, actionable messages in UI; no stack traces shown to user; React error boundary; Retry button where applicable (RNF-18)
- [ ] **NF-16**: Design system: dark background #0f0f14, cards #1a1a24, accent indigo #6366f1, Inter/system-ui typography; Lighthouse Accessibility >= 90 (RNF-19)
- [x] **NF-17**: CI/CD with GitHub Actions; merge to main auto-deploys to staging; production deploy requires manual approval (RNF-22)

---

## v2 Requirements (Deferred)

### Future Platforms
- Glassdoor + LinkedIn Salary integration
- Automated apply on Indeed and Computrabajo (search only in v1)
- ATS integrations (Workable, BambooHR, Greenhouse)

### Future Features
- Mobile app (React Native + Expo)
- Word (.docx) CV parsing
- ML-based scoring model
- Automated email reply tracking
- Interview preparation module
- Subscription / payment plans
- Multi-language UI (beyond ES/EN)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-apply on Indeed/Computrabajo | No reliable programmatic flow; LinkedIn Easy Apply only |
| Mobile app | Phase 2; web-first MVP |
| ML scoring | Claude API is accurate enough; custom ML is months of work |
| .docx CV parsing | pdf-parse covers 90%+ of users |
| ATS integrations | No demand signal for MVP |
| Salary intelligence | Secondary concern |
| Email reply tracking | Requires inbox OAuth; high privacy sensitivity |
| Payments/subscriptions | Personal use MVP |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| NAV-01 | Phase 6 | Pending |
| PROF-01 | Phase 2 | Complete |
| PROF-02 | Phase 2 | Complete |
| PROF-03 | Phase 2 | Complete |
| PROF-04 | Phase 2 | Complete |
| SRCH-01 | Phase 2 | Complete |
| SRCH-02 | Phase 2 | Complete |
| SRCH-03 | Phase 4 | Pending |
| AUTO-01 | Phase 4 | Pending |
| AUTO-02 | Phase 4 | Pending |
| AUTO-03 | Phase 4 | Pending |
| AUTO-04 | Phase 4 | Pending |
| APPLY-01 | Phase 5 | Pending |
| APPLY-02 | Phase 5 | Pending |
| APPLY-03 | Phase 5 | Pending |
| APPLY-04 | Phase 4 | Pending |
| HIST-01 | Phase 5 | Pending |
| HIST-02 | Phase 5 | Pending |
| HIST-03 | Phase 5 | Pending |
| HIST-04 | Phase 4 | Pending |
| REPT-01 | Phase 7 | Pending |
| REPT-02 | Phase 7 | Pending |
| REPT-03 | Phase 7 | Pending |
| REPT-04 | Phase 7 | Pending |
| RT-01 | Phase 3 | Pending |
| NF-01 | Phase 6 | Pending |
| NF-02 | Phase 4 | Pending |
| NF-03 | Phase 2 | Complete |
| NF-04 | Phase 5 | Pending |
| NF-05 | Phase 3 | Pending |
| NF-06 | Phase 1 | Complete |
| NF-07 | Phase 1 | Complete |
| NF-08 | Phase 2 | Complete |
| NF-09 | Phase 1 | Complete |
| NF-10 | Phase 1 | Complete |
| NF-11 | Phase 1 | Complete |
| NF-12 | Phase 1 | Complete |
| NF-13 | Phase 1 | Complete |
| NF-14 | Phase 6 | Pending |
| NF-15 | Phase 6 | Pending |
| NF-16 | Phase 6 | Pending |
| NF-17 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Traceability updated: 2026-03-11 (roadmap v1.0)*
*Source: docs/JobAgent-Requerimientos-MVP-v1.1.docx*
