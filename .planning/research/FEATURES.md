# Features Research — Job Agent SaaS

**Project:** Job Agent
**Dimension:** Features
**Mode:** Brownfield — evolving CLI tool to SaaS
**Confidence:** HIGH

---

## Table Stakes (must have or users leave)

### Authentication & Identity
- OAuth login (LinkedIn + Google) — users expect SSO, password auth is a blocker
- JWT session with refresh — stateless sessions required for SaaS
- Per-user data isolation — users cannot see each other's data (critical trust requirement)

### Profile Management
- Import professional profile from LinkedIn API or CV PDF — core input to the system
- Editable profile (skills, seniority, languages, location) — users need to correct parser errors
- Profile completeness indicator — prevents bad search results due to missing fields

### Search Configuration
- Keyword + location + modality + seniority + platform filters — users configure what to search
- Persistent config in database (not just YAML) — multi-device, multi-session access
- Platform selection (LinkedIn, Indeed, Computrabajo) — multi-source is expected

### Automation Core
- Automated job search across configured platforms — the reason the product exists
- Compatibility scoring 0-100 per vacancy — without this, users see noise not signal
- Deduplication across sessions — applying twice to same job destroys credibility
- Easy Apply automation (LinkedIn) — highest-volume apply mechanism
- Rate limiting (3-5s search, 8-12s apply) — account safety is non-negotiable
- CAPTCHA detection and graceful stop — must not get user's LinkedIn banned

### Application History
- Full history of all applications across sessions — users need to know what happened
- Filter by date, platform, company, status — history is useless without search
- Deduplication enforcement — vacancies already in history excluded from new searches

### Reports
- Session report with totals and breakdown — minimum viable audit trail
- Sent emails log (company, role, recipient, status, body) — email apply requires proof
- Link to each vacancy in reports — users need to follow up manually

---

## Differentiators (competitive advantage)

### Already Implemented (need SaaS hardening)
- **Bilingual Playwright automation (EN/ES)** — unique in the market, handles Spanish LinkedIn natively
- **Email apply via Claude API** — generates personalized emails, sends via SMTP, logs everything
- **Multi-platform search** — LinkedIn + Indeed + Computrabajo in parallel (rare combination for LATAM market)
- **MCP Server architecture** — linkedin-mcp as tool-calling interface, extensible to new platforms

### To Build
- **Real-time session progress via SSE** — users watch the agent work live (engagement + trust)
- **Aggregated metrics dashboard** — tasa de respuesta, mejores plataformas, empresas más aplicadas
- **Email preview + approval modal** — user reviews AI-generated email before send (trust + control)
- **Multiple search presets** — power users run different configs for different job types
- **Manual status tracking** (interview scheduled, offer received, rejected) — closes the loop

---

## Anti-Features (deliberately NOT building in MVP)

| Feature | Reason |
|---------|--------|
| Auto-apply on Indeed/Computrabajo | LinkedIn Easy Apply is the only reliable programmatic flow; others require complex form detection |
| Mobile app | Web-first MVP; React Native Phase 2 only |
| ML-based scoring | Claude API is fast and accurate enough; custom ML is months of work |
| Word (.docx) CV parsing | pdf-parse covers 90%+ of users; docx adds complexity |
| ATS integrations (Workable, Greenhouse) | No demand signal yet; out of scope |
| Salary intelligence (Glassdoor) | Secondary concern; users care about applying, not salary lookup |
| Automated email reply tracking | Inbox access requires Gmail/Outlook OAuth; high privacy sensitivity |
| Subscription/payments | MVP is personal use; monetization is Phase 3+ |

---

## Feature Dependencies (build order)

```
OAuth + JWT
    └── User profile (LinkedIn scan + CV upload)
            └── Search config (per-user, MongoDB)
                    └── Automated search (multi-platform)
                            └── Scoring + deduplication
                                    └── Easy Apply + email apply
                                            └── Application history
                                                    └── Session reports
                                                            └── Dashboard metrics
```

No circular dependencies. Critical path is linear from auth to dashboard.

---

## SaaS Hardening Items (brownfield rework)

These exist in code but are single-user / CLI only — need multi-user SaaS treatment:

| Item | Current State | Required Change |
|------|--------------|-----------------|
| config.yaml | File-based, single user | MongoDB per-user config document |
| output/ files | Shared directory, no user scoping | Per-user namespacing or DB storage |
| Easy Apply auth | Uses single LinkedIn session | Per-user browser session isolation |
| SSE progress | Not implemented | NestJS EventEmitter → SSE endpoint |
| Rate limiter | In-process, single session | Redis-backed, per-user rate tracking |
| Deduplication | In-memory per session | MongoDB persistent per-user history |

---

## Phase Implications

| Phase | Features |
|-------|---------|
| 1 — Foundation | OAuth, JWT, user profile, per-user MongoDB config, NestJS auth/users modules |
| 2 — Core Automation | Multi-platform search, scoring, dedup, Easy Apply, SSE real-time progress |
| 3 — Application Management | History, detail view, manual status, email apply + approval modal |
| 4 — Reporting & Dashboard | Session reports, emails log, CSV/PDF export, aggregated metrics |

---

*Research completed: 2026-03-11*
*Source: PROJECT.md, CONCERNS.md, INTEGRATIONS.md, existing codebase analysis*
