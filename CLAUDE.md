# Job Application Agent — Build Instructions

## Project Overview
Production-ready TypeScript monorepo that autonomously searches for jobs across multiple platforms,
scores them against the candidate's CV, and applies automatically via LinkedIn Easy Apply, Greenhouse
API/Playwright, and Lever API. The user interacts entirely through the browser — no terminal needed.

## Tech Stack
- Language: TypeScript (strict mode, no `any`)
- Runtime: Node.js 18+ (ESM — `"type": "module"` in every package.json)
- Structure: npm workspaces monorepo
- Browser automation: Playwright + Chromium
- CV parsing: pdf-parse + mammoth
- API: Express.js + SSE for real-time progress
- Config: js-yaml + dotenv
- Logs: chalk + winston

## Current Version: v2 (multi-platform, browser-first)

### Architecture
```
npm start
  └─► Express on port 3000
  └─► Opens http://localhost:3000 in browser
        ↓ User fills form + uploads CV
  POST /api/run
        ↓ SSE stream
  GET /api/run/progress  (real-time step events)
        ↓ Agent finishes
  GET /api/report        (JSON results → report.html)
```

## Monorepo Structure
```
job-agent/
├── package.json                  (root workspaces)
├── tsconfig.base.json            (strict, Node16 ESM)
├── .env                          (LinkedIn credentials — gitignored)
├── .env.example
├── config.yaml                   (user search config — gitignored)
├── CLAUDE.md
│
├── packages/
│   ├── core/                     (@job-agent/core) — shared types only
│   │   └── src/types/
│   │       ├── cv.types.ts       (ProfessionalProfile, WorkExperience, …)
│   │       ├── job.types.ts      (JobListing, ApplicationRecord, PlatformId)
│   │       └── config.types.ts   (AppConfig incl. platforms & applicationDefaults)
│   │
│   ├── cv-parser/                (@job-agent/cv-parser)
│   │   └── src/
│   │       ├── parsers/pdf.parser.ts
│   │       ├── extractors/profile.builder.ts
│   │       └── index.ts          (parseCV)
│   │
│   ├── linkedin-mcp/             (@job-agent/linkedin-mcp)
│   │   └── src/
│   │       ├── tools/
│   │       │   ├── search-jobs.tool.ts
│   │       │   ├── get-job-details.tool.ts
│   │       │   └── easy-apply.tool.ts    ← fillTextInputs + fillRadioButtons
│   │       ├── browser/
│   │       │   ├── linkedin.session.ts
│   │       │   └── selectors.constants.ts
│   │       ├── scoring/job-matcher.ts    (rankJobs)
│   │       └── agent.ts                  (runLinkedInAgent)
│   │
│   ├── job-search/               (@job-agent/job-search)
│   │   └── src/
│   │       ├── interfaces/platform.interface.ts  (IPlatformSearcher)
│   │       ├── platforms/
│   │       │   ├── linkedin.searcher.ts
│   │       │   ├── indeed.searcher.ts
│   │       │   ├── computrabajo.searcher.ts
│   │       │   ├── bumeran.searcher.ts
│   │       │   ├── getonboard.searcher.ts
│   │       │   ├── infojobs.searcher.ts
│   │       │   └── greenhouse.searcher.ts
│   │       └── index.ts          (runMultiPlatformSearch)
│   │
│   ├── ats-apply/                (@job-agent/ats-apply)
│   │   └── src/
│   │       ├── detectors/ats-detector.ts     (detectAts)
│   │       ├── handlers/
│   │       │   ├── greenhouse.handler.ts     (REST API apply)
│   │       │   ├── greenhouse-playwright.handler.ts  (form fallback)
│   │       │   └── lever.handler.ts          (REST API apply)
│   │       ├── cover-letter.ts               (generateCoverLetter EN+ES)
│   │       └── index.ts          (applyToAts)
│   │
│   ├── api/                      (@job-agent/api)
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── agent.routes.ts   (POST /api/run, SSE /api/run/progress, GET /api/report)
│   │       │   ├── config.routes.ts
│   │       │   └── cv.routes.ts
│   │       ├── middleware/error.middleware.ts
│   │       └── server.ts
│   │
│   └── reporter/                 (@job-agent/reporter)
│       └── src/
│           ├── templates/report.template.ts
│           └── index.ts
│
├── apps/
│   ├── ui/
│   │   ├── index.html            (config form — sections: CV, Filters, Platforms,
│   │   │                          Matching, Cover Letter, Application Defaults)
│   │   ├── progress.html         (real-time SSE progress viewer)
│   │   ├── report.html           (report viewer — loads GET /api/report)
│   │   └── assets/
│   │       ├── style.css
│   │       ├── app.js            (form logic + submitConfig + configToYaml)
│   │       ├── progress.js       (SSE EventSource client)
│   │       └── report.js         (fetch /api/report + render cards)
│   │
│   └── cli/                      (simplified — just starts Express + opens browser)
│       └── src/index.ts
│
├── cv/                           (gitignored — user drops CV here)
└── output/                       (gitignored — generated results)
```

## Build Order
```
core → cv-parser → linkedin-mcp → job-search → ats-apply → reporter → api → cli
```

## Key Type Definitions (packages/core)

### config.types.ts — AppConfig
```typescript
export type PlatformId =
  'linkedin' | 'indeed' | 'computrabajo' | 'bumeran' | 'getonboard' | 'infojobs' | 'greenhouse';

export interface AppConfig {
  search: {
    keywords: string[];
    location: string;
    modality: ('Remote' | 'Hybrid' | 'On-site')[];
    languages: string[];
    seniority: string[];
    datePosted: 'past_24h' | 'past_week' | 'past_month';
    excludedCompanies: string[];
    platforms: PlatformId[];            // required — selected in UI checkboxes
    greenhouseCompanies?: string[];     // board slugs, e.g. ["stripe","figma"]
    maxJobsToCollect?: number;
  };
  matching: {
    minScoreToApply: number;
    maxApplicationsPerSession: number;
  };
  coverLetter: {
    language: 'en' | 'es';
    tone: 'professional' | 'casual' | 'enthusiastic';
  };
  report: { format: 'markdown' | 'html' | 'both'; };
  applicationDefaults?: {             // auto-fills LinkedIn Easy Apply + Greenhouse forms
    authorizedToWork?: boolean;
    requiresSponsorship?: boolean;
    willingToRelocate?: boolean;
    salaryExpectation?: string;
    availableFrom?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    howDidYouHear?: string;
    yearsOfExperience?: number;       // auto-set from CV if not provided
  };
}
```

### job.types.ts — JobListing
```typescript
export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  modality: 'Remote' | 'Hybrid' | 'On-site';
  description: string;
  requiredSkills: string[];
  postedAt: string;
  applyUrl: string;
  platform: PlatformId;        // required — added in v2
  hasEasyApply: boolean;
  compatibilityScore: number;
}

export type ApplicationStatus =
  | 'applied'
  | 'easy_apply_not_available'
  | 'already_applied'
  | 'failed'
  | 'skipped_low_score';

export type ApplicationMethod =
  | 'linkedin_easy_apply'
  | 'greenhouse_api'
  | 'lever_api'
  | 'email'
  | 'manual';
```

## Coding Standards (enforce strictly)
- All interfaces in `packages/core/src/types/` — never define types inline
- No `any` — use `unknown` and type guards instead
- All async functions must handle errors with typed `try/catch`
- LinkedIn CSS selectors must live ONLY in `selectors.constants.ts` (never hardcoded inline)
- Every public function must have a JSDoc comment
- Use `chalk` for console output: info (blue), success (green), warn (yellow), error (red)
- Config always read from `config.yaml` via `js-yaml`, never hardcoded values
- English comments and variable names throughout
- `"type": "module"` — all imports must include `.js` extension even for `.ts` source files
- `exactOptionalPropertyTypes: true` — never assign `undefined` to optional fields explicitly

## CSS Rules (apps/ui/assets/style.css)
- Dark theme uses CSS custom properties (--bg-*, --text-*, --primary, --border, etc.)
- Input selectors MUST include ALL input types: `text`, `number`, `email`, `url`
  ```css
  input[type="text"], input[type="number"], input[type="email"], input[type="url"],
  textarea, select { ... }
  ```
  Missing `type="url"` causes URL inputs to render with browser-default styles (white bg).
- Same rule applies to `:focus` selectors.

## Bilingual Support (EN + ES) — Critical
LinkedIn and Greenhouse show different text by user's account language.
All selectors and regex must handle both:
- Easy Apply badge: `"Easy Apply"` ↔ `"Solicitud sencilla"`
- Next button: `aria-label="Continue to next step"` ↔ `"Continuar al siguiente paso"`
- Submit: `aria-label="Submit application"` ↔ `"Enviar solicitud"`
- Already applied: `aria-label*="Applied"` ↔ `aria-label*="Solicitado"`
- Phone regex: `/phone|tel|mobile|teléfono|telefono|número|numero/i`
- Work auth regex: `/author|eligible|legal.*work|right.*work|permit.*work/i`
- Sponsorship regex: `/sponsor|visa\s*status|visa\s*support|immigration/i`
- Relocation regex: `/relocat/i`

## Easy Apply Form Filling Rules
- `fillTextInputs(page, phone?, defaults?)` — fills phone, salary, GitHub, portfolio, notice period
- `fillRadioButtons(page, defaults?)` — detects question text from legend/h3/span, clicks correct
  Yes/No option for authorization/sponsorship/relocation; falls back to first/last positionally
- Always call both helpers before advancing each step (`advanceStep()`)
- `advanceStep()` priority: error → success → submit → review → next → done
- `waitUntil: 'domcontentloaded'` (NOT `'networkidle'`) — LinkedIn's SPA never reaches networkidle

## Scoring Rules (packages/linkedin-mcp/src/scoring/job-matcher.ts)
- skillsMatch: 50% weight — when `requiredSkills: []`, default is **0.7** (benefit of doubt)
- seniorityMatch: 25% weight
- keywordMatch: 15% weight
- locationMatch: 10% weight
- Keyword matching uses **word boundaries** (`\b`), never substring `.includes()`
  e.g. "engineer" must NOT match "engineering manager"

## ATS Detection & Apply (packages/ats-apply)
URL patterns:
- `boards.greenhouse.io/*` or `job-boards.greenhouse.io/*` → Greenhouse REST API
  Fallback: Playwright form fill if API returns 404/HTML
- `jobs.lever.co/*` → Lever REST API
- Greenhouse Playwright handler fills: standard fields + custom fields via `fillCustomFields()`
  (radio groups for auth/sponsorship/relocation, text inputs for salary/GitHub/portfolio/notice)

## Rate Limiting Rules
- Wait 3–5 s (randomized) between job search scrolls
- Wait 8–12 s (randomized) between Easy Apply submissions
- If LinkedIn shows CAPTCHA or unusual-activity warning: STOP, log, save progress
- Never exceed `config.matching.maxApplicationsPerSession`

## Gitflow Branch Strategy
```
main        ← production releases (tagged vX.Y.Z)
develop     ← integration branch
feature/*   ← new features branched from develop
hotfix/*    ← urgent fixes branched from main, merged to main + develop
release/*   ← release prep branched from develop, merged to main + develop
```

## Important Notes
- All output files are gitignored — never commit personal data
- The `cv/` folder is gitignored — never commit the CV
- `.env` is gitignored — credentials never committed
- `config.yaml` is gitignored — user config never committed
- The API is designed so `apps/ui` can be replaced with React/Angular with zero backend changes
