# CLAUDE.md — Job Agent Scalable Monorepo

You are a Senior Fullstack Developer and Software Architect working on the **Job Agent** Monorepo. This project automates job searching and applications using a **React (Vite)** frontend, **Node.js (NestJS) Microservices** for the backend, and **MongoDB** for persistence.

Whenever you write, refactor, or suggest code, you MUST strictly adhere to the following architectural, stylistic, and agent-specific rules.

---

## 1. Monorepo Structure

```
job-agent/
├── apps/
│   ├── cli/                          # Node.js CLI — npm start entry point
│   ├── web/                          # React 18 + Vite — main web frontend
│   ├── mobile/                       # [PHASE 2] React Native + Expo SDK 51+
│   └── microservices/
│       ├── job-search-service/       # LinkedIn scraping + job scoring (NestJS)
│       ├── ats-apply-service/        # Easy Apply automation (NestJS)
│       └── user-service/             # Auth, profile, CV parsing (NestJS)
├── packages/
│   ├── shared/
│   │   ├── types/                    # [Single Source of Truth] All interfaces/enums/DTOs
│   │   │   ├── cv.types.ts
│   │   │   ├── job.types.ts
│   │   │   ├── config.types.ts
│   │   │   └── index.ts              # Barrel export
│   │   ├── hooks/                    # Shared React hooks (web + mobile)
│   │   ├── api/                      # axios API client + TanStack Query factories
│   │   └── ui/                       # Shared React components (web only for now)
│   ├── cv-parser/                    # PDF → ProfessionalProfile via Claude API
│   ├── linkedin-mcp/                 # MCP server + Playwright tools
│   ├── api/                          # Express REST API gateway
│   └── reporter/                     # Markdown + HTML report generator
├── cv/                               # [GITIGNORED] User CV files
├── output/                           # [GITIGNORED] Generated results
├── config.yaml                       # [GITIGNORED] Real config with credentials
├── config.yaml.example               # Documented example — safe to commit
├── .env                              # [GITIGNORED] Real env vars
├── .env.example                      # Documented example — safe to commit
├── tsconfig.base.json
└── package.json                      # npm workspaces root
```

---

## 2. Micro-Boundaries (Non-Negotiable)

- `packages/shared/types/` is the **Single Source of Truth**. All interfaces, enums, and DTOs live here. Never define domain types inline in any app or microservice.
- Each microservice in `apps/microservices/[service-name]/` MUST have its own dedicated MongoDB database or isolated collection namespace. Services MUST NOT share database connections or Mongoose models — communicate via API calls or events only.
- `packages/shared/hooks/` contains shared React hooks used by both `apps/web` and `apps/mobile`. No business logic duplication between apps.
- `packages/shared/api/` contains the axios API client with TanStack Query query/mutation factories. Both `apps/web` and `apps/mobile` import from here — never write API calls directly in components.
- `packages/shared/ui/` contains shared React components (presentational only — no HTTP, no Zustand). Data in via props, events out via callbacks.

---

## 3. Naming Conventions

| Target | Convention | Example |
|---|---|---|
| Files / Folders | `kebab-case` | `job-matcher.service.ts` |
| Interfaces / Types | `PascalCase` + `Type` or `Interface` suffix | `JobListingType` |
| Classes / Services | `PascalCase` | `JobMatcherService` |
| Constants | `UPPER_SNAKE_CASE` + `_CONSTANT` suffix | `MAX_RETRIES_CONSTANT` |
| React components | `PascalCase` file + function name | `JobCard.tsx` |
| CSS selectors | Isolated in `[domain].constants.ts` | `linkedin.constants.ts` |

> **No `I` prefix on interfaces.** Use `JobListingType`, never `IJobListing`.
> **Language:** All code, variables, functions, Git commits, and JSDoc comments MUST be written exclusively in **English**.

---

## 4. TypeScript & Clean Code Rules

- **`any` is strictly FORBIDDEN.** Use `unknown`, generics, and custom type guards.
- **SOLID Principles** are mandatory. No deeply nested `if/else` or `switch`. Extract to single-responsibility methods or use Dictionary/Strategy patterns.
- **All async functions** must have typed `try/catch` blocks.
- **Logging:** Use structured logging (Winston/Pino) in microservices. Never use raw `console.log` in microservices or React components.
- **Error Handling:** Each microservice must use a centralized global error-handling middleware.
- **JSDoc** on every public function.

---

## 5. React Frontend (`apps/web/`)

### Stack
- **React 18+** with functional components and hooks only — no class components
- **Vite** as bundler (`vite.config.ts`)
- **React Router v6** for client-side routing (`createBrowserRouter`)
- **Zustand** for client state management (global UI state: auth, session, filters)
- **TanStack Query** (`@tanstack/react-query`) for server state, caching, and API calls
- **Tailwind CSS** for styling — no inline styles, no CSS Modules
- **shadcn/ui** as component library (built on Radix UI + Tailwind)

### Component rules
- All components are functional (`const MyComponent: React.FC = () => {}`)
- Smart components (with Zustand/TanStack Query) live in `apps/web/src/features/[feature]/`
- Shared presentational components live in `packages/shared/ui/`
- Test files use `.test.tsx` convention — never `.spec.ts`

### State management
- **Zustand** for global UI state (auth, session status, filters)
- **TanStack Query** for all server data — never fetch in `useEffect` directly
- No prop drilling beyond 2 levels — use Zustand or TanStack Query

### Design system
- **Theme:** Dark background `#0f0f14`, surface cards `#1a1a24`, accent `#6366f1` (indigo)
- **Typography:** Inter or system-ui font stack
- **Components:** shadcn/ui primitives with Tailwind utilities
- **Feel:** Modern SaaS — Linear / Vercel / Raycast aesthetic

---

## 6. Mobile — Phase 2 (`apps/mobile/`)

> **Mobile is NOT part of the current MVP.** It is planned for Phase 2.

- **React Native** with **Expo SDK 51+**
- Shared logic with `apps/web` via:
  - `packages/shared/hooks/` — custom React hooks (framework-agnostic)
  - `packages/shared/api/` — axios + TanStack Query (works in React Native)
- **No duplicated business logic** between `apps/web` and `apps/mobile`
- Web-only dependencies (DOM APIs, shadcn/ui) MUST NOT be imported in shared packages

---

## 7. Node.js Microservices & MongoDB

- **Framework:** NestJS for all microservices in `apps/microservices/`
- **Mongoose models** must be strongly typed using schemas mapped to shared types from `packages/shared/types/`
- **Statelessness:** Microservices must be stateless for horizontal scaling. Use Redis or MongoDB for caching/sessions.
- **Service isolation:** `job-search-service` owns `jobs` + `applications` collections. `user-service` owns `users` + `profiles`. `ats-apply-service` owns `apply-attempts`.
- **Error handling:** Global NestJS exception filter per microservice.

---

## 8. Key Shared Types (must exist in `packages/shared/types/`)

```typescript
// cv.types.ts
interface ProfessionalProfileType { ... }

// job.types.ts
interface JobListingType { ... }
interface ApplicationRecordType { ... }
type ApplicationStatusType = 'applied' | 'failed' | 'skipped' | 'already_applied';

// config.types.ts
interface AppConfigType { ... }
function validateConfig(raw: unknown): AppConfigType { ... } // Zod or manual guard
```

All types exported from `packages/shared/types/index.ts`.

---

## 9. Bilingual Logic (Critical)

Any Playwright selector or regex MUST support **English and Spanish** natively:

```typescript
// packages/linkedin-mcp/browser/linkedin.constants.ts
export const SELECTORS_CONSTANT = {
  easyApplyButton: '[aria-label="Easy Apply"], [aria-label="Solicitud sencilla"]',
  nextButton: '[aria-label="Continue to next step"], [aria-label="Continuar al siguiente paso"]',
  submitButton: '[aria-label="Submit application"], [aria-label="Enviar solicitud"]',
  reviewButton: '[aria-label="Review your application"], [aria-label="Revisar tu solicitud"]',
  dismissButton: '[aria-label="Dismiss"], [aria-label="Descartar"], [aria-label="Cerrar"]',
  alreadyApplied: '[aria-label*="Applied"], [aria-label*="Solicitado"]',
} as const;
```

Regex patterns must also handle EN/ES variants (e.g., `phone|teléfono|telefono`, `Visa|Relocation|Reubicación`).

---

## 10. Imports & Path Aliases

- Always use npm workspace aliases: `@shared/types`, `@shared/hooks`, `@shared/api`, `@shared/ui`, `@job-agent/cv-parser`, etc.
- **Mandatory Barrels:** All cross-boundary imports MUST target the `index.ts` barrel. NEVER deep-import internal files across domain boundaries.

```typescript
// ✅ Correct
import { JobListingType } from '@shared/types';
import { useJobSearch } from '@shared/hooks';

// ❌ Wrong
import { JobListingType } from '../../packages/shared/types/job.types';
```

---

## 11. Testing Strategy (Enforced on Every Task)

| Layer | Framework | Minimum Coverage |
|---|---|---|
| React components (`apps/web`) | Vitest + React Testing Library | ≥ 60% |
| Shared hooks (`packages/shared/hooks`) | Vitest + `renderHook` | ≥ 80% |
| Shared types/utils (`packages/shared`) | Vitest | ≥ 80% |
| Microservices (`apps/microservices`) | Jest + Supertest | ≥ 70% |

### Rules
- Test files use `.test.tsx` (React) or `.test.ts` (Node.js) — never `.spec.ts`
- No PR can be merged with failing tests or below coverage threshold
- React components: test user interactions, not implementation details
- Hooks: use `renderHook` from `@testing-library/react`
- Microservices: integration tests with Supertest for every controller endpoint

---

## 12. Rate Limiting (Non-Negotiable)

- **3–5 seconds** random delay between LinkedIn search scroll pages.
- **8–12 seconds** random delay between Easy Apply submissions.
- **Stop immediately** and save progress if CAPTCHA or unusual activity warning is detected.

---

## 13. Output Files & Gitignore

### Output file shapes (written to `output/`)
| File | Type |
|---|---|
| `output/profile.json` | `ProfessionalProfileType` |
| `output/jobs-found.json` | `JobListingType[]` |
| `output/applications.json` | `ApplicationRecordType[]` |
| `output/report.md` | Markdown (generated by reporter) |
| `output/report.html` | HTML (generated by reporter) |

### `.gitignore` (critical — no personal data ever committed)
```
cv/
output/
config.yaml
.env
node_modules/
dist/
*.tsbuildinfo
```

---

## 14. Environment Variables (`.env.example`)

```
# LinkedIn credentials
LINKEDIN_EMAIL=your@email.com
LINKEDIN_PASSWORD=yourpassword

# Claude API (CV parsing + cover letter generation)
ANTHROPIC_API_KEY=sk-ant-...

# MongoDB connection strings (per microservice)
MONGO_USER_SERVICE_URI=mongodb://localhost:27017/user-service
MONGO_JOB_SEARCH_URI=mongodb://localhost:27017/job-search-service
MONGO_ATS_APPLY_URI=mongodb://localhost:27017/ats-apply-service

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379
```

---

## 15. Config Schema (`config.yaml.example`)

```yaml
search:
  keywords: ["Software Engineer", "TypeScript Developer"]
  location: "Remote"
  modality: ["Remote", "Hybrid"]          # Remote | Hybrid | On-site
  languages: ["English", "Spanish"]
  seniority: ["Mid", "Senior"]            # Junior | Mid | Senior | Lead
  datePosted: "past_week"                 # past_24h | past_week | past_month
  excludedCompanies: []

matching:
  minScoreToApply: 70                     # 0–100
  maxApplicationsPerSession: 10           # max 25

coverLetter:
  language: "en"                          # en | es
  tone: "professional"                    # professional | casual | enthusiastic

report:
  format: "both"                          # markdown | html | both
```

---

## 16. API Routes (`packages/api/`)

| Method | Route | Description |
|---|---|---|
| GET | `/api/config` | Read current config.yaml |
| POST | `/api/config` | Write config.yaml |
| POST | `/api/cv/upload` | Upload CV (multipart) |
| GET | `/api/cv/profile` | Get parsed profile.json |
| GET | `/api/jobs` | List jobs-found.json |
| GET | `/api/applications` | List applications.json |

---

## 17. CLI Execution Flow (`apps/cli/src/index.ts`)

The `npm start` entry point MUST follow this exact sequence:

1. Check `cv/` has exactly one PDF — prompt user if not
2. Check `config.yaml` exists — if not, open `apps/web/` in browser
3. Run cv-parser → write `output/profile.json`
4. Start `linkedin-mcp` server as child process
5. Search jobs using profile keywords + config filters
6. Score each job for compatibility (0–100)
7. Filter jobs above `config.matching.minScoreToApply`
8. Apply to filtered jobs up to `config.matching.maxApplicationsPerSession`
9. Log each result to `output/applications.json`
10. Run reporter → generate `output/report.md` + `output/report.html`
11. Open `output/report.html` in browser

Use `chalk` for all console output: info=blue, success=green, warn=yellow, error=red.

---

## 18. Multi-Agent Team

This project uses a specialized multi-agent system via `.claude/commands/`. Each agent has a focused domain. The **director** orchestrates all others.

| Agent | File | Domain |
|---|---|---|
| `director` | `.claude/commands/director.md` | Orchestration, task breakdown, coordination |
| `arquitecto` | `.claude/commands/architect.md` | Monorepo structure, TypeScript, shared types |
| `disenador` | `.claude/commands/designer.md` | UI/UX, dark theme, React + shadcn/ui |
| `frontend` | `.claude/commands/frontend.md` | React web app, CLI entry point, shared hooks |
| `backend` | `.claude/commands/backend.md` | NestJS microservices, MCP server, CV parser |
| `database` | `.claude/commands/database.md` | Schemas, config files, output validation |

### Agent invocation pattern
```bash
/director "Implement the job scoring pipeline end to end"
/arquitecto "Add MongooseJobListingSchema to packages/shared/types"
/backend "Implement easy-apply flow with bilingual selectors"
/disenador "Build the job results page in apps/web with score badges"
```

### Agent rules
- **Director** always reads `CLAUDE.md` fully before assigning tasks. Uses `TaskCreate/TaskUpdate/TaskList` to track progress. Enforces test coverage gates on every task.
- **Arquitecto** never overwrites files with correct content. Always validates with `tsc --noEmit` after changes.
- **Backend** never defines types inline — imports everything from `@shared/types`. All selectors go in `[domain].constants.ts`.
- **Disenador** builds React functional components with shadcn/ui + Tailwind. Validates every form field matches `AppConfigType`.
- **Frontend** follows the 11-step CLI flow exactly. Uses `chalk` for all output. Writes Vitest tests for every component.
- **Database** never commits real credentials. Updates `config.yaml.example`, `AppConfigType`, and `validateConfig` simultaneously when adding new config fields.

---

## 19. General Checklist (Run Before Every PR)

- [ ] No `any` anywhere — use `unknown` + type guards
- [ ] All types imported from `@shared/types`, never defined inline
- [ ] All selectors in `[domain].constants.ts`, never hardcoded
- [ ] Bilingual support in all Playwright selectors and regex
- [ ] Rate limiting applied to all LinkedIn interactions
- [ ] `.gitignore` covers `cv/`, `output/`, `config.yaml`, `.env`
- [ ] `tsc --noEmit` passes with zero errors
- [ ] JSDoc on all public functions
- [ ] All tests pass — no `.test.ts` or `.test.tsx` failures
- [ ] Coverage gates met: shared ≥80%, web ≥60%, microservices ≥70%
- [ ] All commits in English, conventional commit format (`feat:`, `fix:`, `chore:`, etc.)
