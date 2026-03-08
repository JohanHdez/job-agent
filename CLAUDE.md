# Job Application Agent — Build Instructions

## Project Overview
Build a production-ready, TypeScript monorepo that acts as an autonomous LinkedIn
job application agent. The user uploads their CV (PDF), the agent analyzes their
professional profile, searches LinkedIn for matching jobs, applies automatically
via Easy Apply, and generates a report.

## Tech Stack
- Language: TypeScript (strict mode, no `any`)
- Runtime: Node.js 18+
- Structure: npm workspaces monorepo
- Browser automation: Playwright + Chromium
- MCP Server: @modelcontextprotocol/sdk
- CV parsing: pdf-parse + mammoth
- API: Express.js
- Config: js-yaml + dotenv
- Logs: chalk + winston

## Monorepo Structure to Create
```
job-agent/
├── package.json                  (root, workspaces)
├── tsconfig.base.json            (shared TS config)
├── .env.example
├── .gitignore
├── CLAUDE.md                     (this file)
│
├── .claude/
│   └── commands/                 (agent skill definitions — slash commands)
│       ├── director.md           (/director  — team lead, task coordination)
│       ├── architect.md          (/architect — monorepo, TypeScript, interfaces)
│       ├── designer.md           (/designer  — dark theme UI, SaaS look)
│       ├── frontend.md           (/frontend  — form wiring, CLI orchestrator)
│       ├── backend.md            (/backend   — MCP server, API, cv-parser)
│       └── database.md           (/database  — schemas, config.yaml, .gitignore)
│
├── packages/
│   ├── core/                     (shared types & interfaces)
│   │   ├── src/types/
│   │   │   ├── cv.types.ts
│   │   │   ├── job.types.ts
│   │   │   ├── config.types.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cv-parser/                (PDF parser subagent)
│   │   ├── src/
│   │   │   ├── parsers/pdf.parser.ts
│   │   │   ├── extractors/profile.builder.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── linkedin-mcp/             (MCP Server - most critical)
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   │   ├── search-jobs.tool.ts
│   │   │   │   ├── get-job-details.tool.ts
│   │   │   │   └── easy-apply.tool.ts
│   │   │   ├── browser/
│   │   │   │   ├── linkedin.session.ts
│   │   │   │   └── selectors.constants.ts
│   │   │   ├── scoring/job-matcher.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                      (Express REST API)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── config.routes.ts
│   │   │   │   ├── cv.routes.ts
│   │   │   │   └── jobs.routes.ts
│   │   │   ├── middleware/error.middleware.ts
│   │   │   └── server.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── reporter/                 (Report generator subagent)
│       ├── src/
│       │   ├── templates/report.template.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   ├── ui/                       (Browser form - HTML vanilla today, React/Angular ready tomorrow)
│   │   ├── index.html            (filters form: keywords, location, modality, language, seniority, salary, max applications)
│   │   ├── report.html           (report viewer)
│   │   └── assets/
│   │       ├── style.css
│   │       └── app.js
│   │
│   └── cli/                      (CLI entry point for Claude Code)
│       ├── src/index.ts
│       └── package.json
│
├── cv/                           (user drops CV here - gitignored)
├── output/                       (generated results - gitignored)
│   ├── profile.json
│   ├── jobs-found.json
│   ├── applications.json
│   └── report.md
```

## Coding Standards (enforce strictly)
- All interfaces in `packages/core/src/types/` — never define types inline
- No `any` — use `unknown` and type guards instead
- All async functions must handle errors with typed `try/catch`
- LinkedIn CSS selectors must live ONLY in `selectors.constants.ts` (never hardcoded inline)
- Every public function must have a JSDoc comment
- Use `chalk` for all console output with consistent levels: info (blue), success (green), warn (yellow), error (red)
- Config always read from `config.yaml` via `js-yaml`, never hardcoded values
- English comments and variable names throughout (for LinkedIn shareability)

## Bilingual LinkedIn Support (EN + ES) — Critical
LinkedIn shows different text depending on the user's account language. All selectors and
regex patterns must handle **both English and Spanish**:
- Easy Apply badge: `"Easy Apply"` → `"Solicitud sencilla"`
- Next button: `aria-label="Continue to next step"` → `"Continuar al siguiente paso"`
- Submit button: `aria-label="Submit application"` → `"Enviar solicitud"`
- Review button: `aria-label="Review your application"` → `"Revisar"` / `"Revisar tu solicitud"`
- Dismiss button: `aria-label="Dismiss"` → `"Descartar"` / `"Cerrar"`
- Already applied: `aria-label*="Applied"` → `aria-label*="Solicitado"`
- Phone label regex: `/phone|tel|mobile|teléfono|telefono|número|numero/i`

All selector values in `selectors.constants.ts` use comma-separated CSS selectors to cover
both languages in a single `page.locator()` call.

## Easy Apply Form Filling Rules
- `fillTextInputs()` — fills empty text inputs matching phone/tel/mobile labels (EN + ES)
- `fillRadioButtons()` — exists in `easy-apply.tool.ts`; clicks first option only if no radio
  in the group is already checked (safe fallback for resume selection and Yes/No questions)
- Always call both fill helpers before advancing each step (`advanceStep()`)
- `advanceStep()` priority: error > success > submit > review > next > done

## References Folder
`references/` contains PNG screenshots captured during real LinkedIn sessions.
Use them to verify selectors are still valid when LinkedIn updates its frontend.
Do NOT commit personal data screenshots to this folder.

## Key Type Definitions to Create in core/

### cv.types.ts
```typescript
export interface ProfessionalProfile {
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  headline: string;
  summary: string;
  seniority: 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Principal' | 'Executive';
  yearsOfExperience: number;
  skills: string[];
  techStack: string[];
  languages: Language[];
  experience: WorkExperience[];
  education: Education[];
}

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate: string | 'Present';
  description: string[];
  technologies: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  graduationYear: number;
}

export interface Language {
  name: string;
  level: 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Basic';
}
```

### job.types.ts
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
  hasEasyApply: boolean;
  compatibilityScore: number;
}

export type ApplicationStatus =
  | 'applied'
  | 'easy_apply_not_available'
  | 'already_applied'
  | 'failed'
  | 'skipped_low_score';

export interface ApplicationRecord {
  job: JobListing;
  status: ApplicationStatus;
  appliedAt: string;
  errorMessage?: string;
}
```

### config.types.ts
```typescript
export interface AppConfig {
  search: {
    keywords: string[];
    location: string;
    modality: ('Remote' | 'Hybrid' | 'On-site')[];
    languages: string[];
    seniority: string[];
    datePosted: 'past_24h' | 'past_week' | 'past_month';
    excludedCompanies: string[];
  };
  matching: {
    minScoreToApply: number;
    maxApplicationsPerSession: number;
  };
  coverLetter: {
    language: 'en' | 'es';
    tone: 'professional' | 'casual' | 'enthusiastic';
  };
  report: {
    format: 'markdown' | 'html' | 'both';
  };
}
```

## MCP Server Tools to Implement

The linkedin-mcp package must expose these MCP tools:

1. **search_jobs** — Search LinkedIn jobs using Playwright, returns JobListing[]
2. **get_job_details** — Get full description of a specific job by ID
3. **easy_apply** — Execute Easy Apply flow for a job ID, returns ApplicationRecord
4. **check_rate_limit** — Returns boolean if we should pause (respect LinkedIn limits)

## UI Form Requirements (apps/ui/index.html)

Create a professional, modern single-page form with these fields:
- Job keywords (text input with tag chips)
- Target location (text input)
- Work modality (checkboxes: Remote, Hybrid, On-site)
- Languages (checkboxes: English, Spanish, Portuguese, French)
- Seniority level (multi-select: Junior, Mid, Senior, Lead)
- Date posted filter (radio: Last 24h, Last week, Last month)
- Minimum compatibility score (slider 0-100, default 70)
- Max applications per session (number input, default 10, max 25)
- Excluded companies (tag input)
- Cover letter language (radio: English, Spanish)
- Cover letter tone (radio: Professional, Casual, Enthusiastic)

On form submit: write config.yaml to the project root and show a success message.
The form must be beautiful, production-quality UI — not a basic HTML form.
Use a dark theme with modern typography. Must look like a real SaaS product.

## Execution Flow (when running `npm start`)

1. Check that `cv/` folder has exactly one PDF file — if not, prompt user
2. Check that `config.yaml` exists — if not, open `apps/ui/index.html` in browser
3. Run cv-parser → generate `output/profile.json`
4. Start linkedin-mcp server
5. Search jobs using profile keywords + config filters
6. Score each job for compatibility against profile
7. Filter jobs above `config.matching.minScoreToApply`
8. Apply to filtered jobs up to `config.matching.maxApplicationsPerSession`
9. For each application: log result to `output/applications.json`
10. Run reporter → generate `output/report.md` and `output/report.html`
11. Open `output/report.html` in default browser

## Rate Limiting Rules (critical — do not skip)
- Wait 3-5 seconds (randomized) between each job search scroll
- Wait 8-12 seconds (randomized) between each Easy Apply submission
- If LinkedIn shows a CAPTCHA or unusual activity warning: STOP, log the error, save progress
- Never exceed maxApplicationsPerSession from config

## README.md to Generate
Create a professional README with:
- Project description and motivation
- Architecture diagram (ASCII)
- Prerequisites
- Installation steps
- Usage guide
- Configuration reference (all config.yaml fields)
- Project structure explanation
- How to extend/migrate to React or Angular
- Contributing guide
- License (MIT)
- Note: "⚠️ Use responsibly. Respect LinkedIn's Terms of Service."

## Team Agent Skills (Slash Commands)

Skills live in `.claude/commands/`. Each file defines a specialized role with full project
context pre-loaded. Invoke them as slash commands followed by your instruction:

```
/director  build the full monorepo skeleton and assign tasks to the team
/architect create packages/core with all shared TypeScript interfaces
/designer  implement index.html with dark theme and tag-chip inputs
/frontend  wire app.js form submission and implement apps/cli/src/index.ts
/backend   implement the MCP server with Easy Apply and bilingual selectors
/database  set up config.yaml.example, .env.example, and JSON schemas
```

| Command       | Role                    | Owns                                          |
|---------------|-------------------------|-----------------------------------------------|
| `/director`  | Team lead               | Task creation, coordination, blockers         |
| `/architect` | Technical architect     | Monorepo, tsconfig, packages/core types       |
| `/designer`  | UX/UI designer          | apps/ui HTML/CSS/JS, dark SaaS theme          |
| `/frontend`  | Frontend developer      | app.js wiring, apps/cli orchestrator          |
| `/backend`   | Backend developer       | linkedin-mcp, packages/api, cv-parser         |
| `/database`  | Data specialist         | config.yaml, .env, JSON schemas, .gitignore   |

Each skill file receives `$ARGUMENTS` (your instruction after the slash command) and includes
all relevant coding standards, type contracts, and bilingual selector rules so the agent can
work autonomously without needing additional context.

## Important Notes
- All output files are gitignored — never commit personal data
- The `cv/` folder is gitignored — never commit the CV
- LinkedIn selectors change frequently — all selectors in selectors.constants.ts with comments indicating what they target
- The API package (packages/api) must be designed so apps/ui can be replaced with React/Angular with zero backend changes
- Code must be clean enough to share on LinkedIn as a portfolio project