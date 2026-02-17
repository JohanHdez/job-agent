# 🤖 Job Agent

> An autonomous LinkedIn job application agent powered by AI, MCP, and Playwright.

Upload your CV once. The agent reads your profile, searches LinkedIn, scores every job for compatibility, and applies automatically via Easy Apply — while you focus on what matters.

**Bilingual support:** works with LinkedIn in English and Spanish (detects "Easy Apply" and "Solicitud sencilla", handles Spanish modal buttons and form labels).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        CLI (apps/cli)                   │
│           Orchestrates the full 11-step pipeline        │
└──────────────┬─────────────────────────┬────────────────┘
               │                         │
   ┌───────────▼──────────┐  ┌───────────▼──────────────┐
   │   CV Parser          │  │   LinkedIn MCP Server     │
   │   (packages/cv-parser│  │   (packages/linkedin-mcp) │
   │   PDF → Profile JSON │  │   MCP Tools via Playwright│
   └──────────────────────┘  └──────────────┬────────────┘
                                             │
                              ┌──────────────▼────────────┐
                              │   Chromium (Playwright)   │
                              │   LinkedIn.com session    │
                              └───────────────────────────┘

   ┌──────────────────────┐  ┌───────────────────────────┐
   │   Reporter           │  │   API (packages/api)      │
   │   MD + HTML reports  │  │   Express REST endpoints  │
   └──────────────────────┘  └──────────────┬────────────┘
                                             │
                              ┌──────────────▼────────────┐
                              │   UI (apps/ui)            │
                              │   Dark-theme SaaS form    │
                              └───────────────────────────┘
```

## Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org))
- **npm** 9+ (bundled with Node.js)
- A **LinkedIn** account with Easy Apply enabled
- An **Anthropic API key** (for future AI features)

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/youruser/job-agent.git
cd job-agent

# 2. Install all dependencies (workspaces)
npm install

# 3. Install Playwright browsers
npx playwright install chromium

# 4. Configure environment variables
cp .env.example .env
# Edit .env with your LinkedIn credentials

# 5. Build all packages
npm run build
```

## Usage

### Option A — Full automated run

```bash
# Drop your CV into the cv/ directory
cp ~/Documents/my-resume.pdf cv/cv.pdf

# Run the agent (opens UI if no config.yaml exists)
npm start
```

### Option B — Configure via UI first

```bash
# Start the API + serve the UI
npm run dev -w packages/api

# Open in browser: http://localhost:3000/index.html
# Fill the form → click "Save Configuration"
# Then run:
npm start
```

### Option C — CLI only (advanced)

```bash
# Copy and edit the config manually
cp config.yaml.example config.yaml
# Edit config.yaml to your needs
npm start
```

## Configuration Reference

All settings live in `config.yaml` (gitignored — never committed):

```yaml
search:
  keywords:              # Job titles / skills to search
    - "Software Engineer"
    - "TypeScript Developer"
  location: "Spain"      # Target location
  modality:              # Remote | Hybrid | On-site
    - Remote
    - Hybrid
  languages:             # Job languages
    - English
  seniority:             # Junior | Mid | Senior | Lead | Principal | Executive
    - Mid
    - Senior
  datePosted: past_week  # past_24h | past_week | past_month
  excludedCompanies:     # Skip jobs from these companies
    - "Bad Company Inc"

matching:
  minScoreToApply: 70          # 0-100 compatibility threshold
  maxApplicationsPerSession: 10 # Hard cap (max 25)

coverLetter:
  language: en             # en | es
  tone: professional       # professional | casual | enthusiastic

report:
  format: both             # markdown | html | both
```

## Project Structure

```
job-agent/
├── packages/
│   ├── core/           # Shared TypeScript types (no runtime deps)
│   ├── cv-parser/      # PDF/DOCX parser → ProfessionalProfile
│   ├── linkedin-mcp/   # MCP Server — LinkedIn browser automation
│   ├── api/            # Express REST API
│   └── reporter/       # Markdown + HTML report generator
│
├── apps/
│   ├── cli/            # Main entry point — orchestrates all steps
│   └── ui/             # Vanilla HTML dark-theme configuration form
│
├── cv/                 # Drop your CV here (gitignored)
├── output/             # Generated results (gitignored)
│   ├── profile.json    # Extracted professional profile
│   ├── jobs-found.json # All discovered jobs with scores
│   ├── applications.json # Application records
│   ├── report.md       # Markdown report
│   └── report.html     # HTML report (auto-opens after session)
│
├── config.yaml         # Your config (gitignored — use config.yaml.example)
└── .env                # Credentials (gitignored — use .env.example)
```

## MCP Tools

The `linkedin-mcp` package exposes 4 tools via the Model Context Protocol:

| Tool | Description |
|------|-------------|
| `search_jobs` | Search LinkedIn with filters, returns scored `JobListing[]` |
| `get_job_details` | Fetch full description and required skills for a job |
| `easy_apply` | Execute the Easy Apply multi-step form (text inputs + radio buttons, EN/ES) |
| `check_rate_limit` | Detect CAPTCHA / unusual activity |

### Easy Apply form handling

The agent navigates multi-step Easy Apply modals automatically:

1. **Text inputs** — fills phone number fields (English and Spanish labels)
2. **Radio buttons** — selects pre-checked options for resume and work permit questions
3. **Navigation** — handles Next / Review / Submit buttons in both English and Spanish
4. **Safety** — closes the modal on error and records the failure without crashing

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |
| GET | `/api/config` | Read current config |
| POST | `/api/config` | Write config.yaml |
| GET | `/api/cv` | Check uploaded CV |
| POST | `/api/cv/upload` | Upload a new CV |
| DELETE | `/api/cv` | Delete current CV |
| GET | `/api/jobs` | List discovered jobs |
| GET | `/api/jobs/applications` | List applications |
| GET | `/api/jobs/summary` | Session summary |
| GET | `/api/jobs/report` | Report availability |

## Migrating to React or Angular

The `packages/api` is 100% frontend-agnostic. To swap the UI:

1. Create `apps/react-ui/` or `apps/angular-ui/`
2. Point your framework's dev server proxy to `http://localhost:3000/api`
3. Use the API endpoints above — no backend changes needed
4. The `@job-agent/core` types package gives you full TypeScript types for all API responses

## Rate Limiting

The agent follows strict rate limits to protect your LinkedIn account:

- **3–5 seconds** random delay between search scroll events
- **8–12 seconds** random delay between Easy Apply submissions
- **Auto-stop** if a CAPTCHA or "unusual activity" warning is detected
- **Hard cap** of `maxApplicationsPerSession` (max 25) per run

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| All jobs show "Easy Apply Not Available" | LinkedIn UI is in Spanish; "Solicitud sencilla" not detected | Already fixed in v1.0.1 — update selectors regex |
| Form navigation stalls | Spanish button aria-labels differ from English | Already fixed — selectors include both EN + ES labels |
| Score 55 for all jobs / all skipped | `requiredSkills` is empty before `get_job_details` enrichment | Lower `minScoreToApply` or wait for enrichment step |
| CAPTCHA detected | LinkedIn rate-limit triggered | Wait 30+ minutes, then reduce `maxApplicationsPerSession` |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes following the coding standards in `CLAUDE.md`
4. Ensure TypeScript compiles: `npm run build`
5. Submit a Pull Request

## License

MIT © 2026 — See [LICENSE](LICENSE) for details.

---

> ⚠️ **Use responsibly.** This tool is for personal use only. Automated interactions with LinkedIn may violate their [Terms of Service](https://www.linkedin.com/legal/user-agreement). The author assumes no responsibility for account restrictions or bans. Use at your own risk.
