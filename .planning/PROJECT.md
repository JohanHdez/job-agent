# Job Agent

## What This Is

Job Agent is a SaaS platform that automates the job search and application process. The user registers their professional profile once (via LinkedIn OAuth, Google OAuth, or CV PDF upload), configures search preferences, and the agent autonomously searches LinkedIn Jobs, Indeed, and Computrabajo — scoring each vacancy for compatibility, applying via Easy Apply or personalized email, and maintaining a full traceable history of all actions.

Target users: software professionals seeking remote/hybrid roles who want to eliminate manual job hunting.

## Core Value

The agent applies to compatible jobs on the user's behalf — so they never have to manually browse, filter, or fill application forms again.

## Requirements

### Validated

- ✓ CLI orchestrator pipeline (11-step flow) — existing
- ✓ CV parser: PDF → ProfessionalProfileType via Claude API — existing
- ✓ LinkedIn MCP server with Playwright (search + Easy Apply, EN+ES bilingual) — existing
- ✓ Express REST API with config/CV/jobs/applications endpoints — existing
- ✓ Shared TypeScript types (ProfessionalProfileType, JobListingType, ApplicationRecordType) — existing
- ✓ Structured logger (Winston, correlationId) — existing
- ✓ HTML dark-theme configuration UI (vanilla) — existing
- ✓ Reporter: Markdown + HTML session reports — existing

### Active

- [ ] LinkedIn OAuth 2.0 login (RF-01)
- [ ] Google OAuth 2.0 login (RF-02)
- [ ] JWT session management with refresh (RF-03)
- [ ] Editable user profile (RF-04)
- [ ] LinkedIn profile scan via API (RF-05)
- [ ] Profile visualization and editing UI (RF-07)
- [ ] Incomplete profile detection (RF-08)
- [ ] Search configuration form with presets (RF-09, RF-10)
- [ ] Multi-platform selection: LinkedIn, Indeed, Computrabajo (RF-11)
- [ ] Automated multi-platform search with Playwright (RF-12)
- [ ] Compatibility scoring 0-100 per vacancy (RF-13)
- [ ] Persistent deduplication and exclusion history in MongoDB (RF-14)
- [ ] Excluded companies filter (RF-15)
- [ ] Easy Apply automation with rate limiting (RF-16)
- [ ] Personalized email application via Claude API + SMTP (RF-17)
- [ ] Email preview and approval modal (RF-18)
- [ ] Per-session application limit enforcement (RF-19)
- [ ] Global application history with filters + CSV export (RF-20)
- [ ] Individual application detail view (RF-21)
- [ ] Manual status update on applications (RF-22)
- [ ] Manual vacancy dismissal (RF-23)
- [ ] Session report in dashboard (RF-24)
- [ ] Sent emails log in report (RF-25)
- [ ] Aggregated metrics dashboard (RF-26)
- [ ] Report export: CSV + PDF (RF-27)
- [ ] Persistent sidebar navigation with avatar (RF-28)
- [ ] NestJS Modular Monolith backend (auth, users, jobs, applications modules)
- [ ] React 18 + Vite frontend replacing vanilla UI
- [ ] Real-time session progress via SSE/WebSocket (RNF-17)
- [ ] CI/CD with GitHub Actions (RNF-22)

### Out of Scope

- Mobile app (React Native) — Phase 2, not MVP
- Glassdoor / LinkedIn Salary integration — v2+
- Word (.docx) CV parsing — v2+
- Automated apply on Indeed/Computrabajo — v2+ (search only for MVP)
- ATS integrations (Workable, BambooHR) — v2+
- Interview preparation module — v2+
- Subscription / payment plans — v2+
- ML-based scoring model — v2+ (Claude API used for MVP)
- Automatic email reply tracking — v2+

## Context

- Existing codebase: fully working CLI-based agent (npm start) with Playwright scraping, CV parsing, and HTML report generation. The vanilla UI serves config and CV upload but is not a full SaaS frontend.
- The vision is to evolve from a CLI tool into a full SaaS web application while keeping the automation core (linkedin-mcp, cv-parser) intact.
- Bilingual support (EN/ES) is implemented throughout Playwright selectors and must be preserved.
- Monorepo structure (npm workspaces): apps/ + packages/ — all shared types live in packages/core.
- The requirements document (docs/JobAgent-Requerimientos-MVP-v1.1.docx) is the source of truth for the MVP.

## Constraints

- **Tech stack**: React 18 + Vite (frontend), NestJS Modular Monolith (backend), MongoDB + Mongoose, Redis (caching), Playwright (automation), Claude API (claude-sonnet-4-6) — locked per requirements doc.
- **Auth**: Passport.js with LinkedIn OAuth2 + Google OAuth2 strategies — no username/password auth.
- **No `any`**: TypeScript strict mode enforced in CI/CD (RNF-13).
- **Rate limiting**: 3-5s between search scrolls, 8-12s between applications — non-negotiable (LinkedIn ToS).
- **Security**: OAuth tokens encrypted AES-256-GCM, row-level security on all MongoDB queries, no secrets in git (RNF-08, RNF-10, RNF-11).
- **Infra**: AWS (EC2/ECS) + Docker + GitHub Actions — target deployment environment.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NestJS Modular Monolith over microservices | Simpler for MVP, modules can be extracted later | — Pending |
| Keep existing linkedin-mcp as the automation core | Already works, bilingual, rate-limited | ✓ Good |
| Replace vanilla UI with React 18 + Vite | SaaS UX requirements, Zustand + TanStack Query needed | — Pending |
| MongoDB over PostgreSQL | Flexible schema for job/application data, team preference | — Pending |
| Claude API for scoring + email generation | Already integrated, fast enough (< 5s target) | ✓ Good |
| Shared types in packages/core as single source of truth | Prevents duplication across apps and packages | ✓ Good |

---
*Last updated: 2026-03-11 after initialization from JobAgent-Requerimientos-MVP-v1.1.docx*
