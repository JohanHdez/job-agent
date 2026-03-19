/**
 * Agent Routes — /api/run, /api/run/progress, /api/search/events, /api/report
 *
 * POST  /api/run             — Start the full agent pipeline, returns { sessionId }
 * GET   /api/run/progress    — SSE stream of raw pipeline progress events
 * GET   /api/search/events   — SSE stream of typed semantic events (job_found, job_applied, …)
 * GET   /api/report          — Returns session summary + applications as JSON
 */

import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import type {
  AppConfig,
  ProfessionalProfile,
  SessionSummary,
  ApplicationRecord,
  JobListing,
  SsePayload,
  SseProgressPayload,
} from '@job-agent/core';
import { logger } from '../utils/logger.js';

export const agentRouter = Router();

// ─── Paths ────────────────────────────────────────────────────────────────────

const CV_DIR = process.env['CV_DIR'] ?? path.resolve('./cv');
const OUTPUT_DIR = process.env['OUTPUT_DIR'] ?? path.resolve('./output');
const CONFIG_PATH = process.env['CONFIG_PATH'] ?? path.resolve('./config.yaml');

// ─── Session state (in-memory, single session) ───────────────────────────────

interface SessionState {
  sessionId: string;
  running: boolean;
  /** Raw pipeline progress events (replayed to late /run/progress subscribers) */
  progressEvents: SseProgressPayload[];
  /** Typed semantic events (replayed to late /search/events subscribers) */
  semanticEvents: SsePayload[];
  /** Counters updated as pipeline runs */
  counters: { found: number; applied: number; skipped: number };
  progressClients: Response[];
  semanticClients: Response[];
}

let session: SessionState | null = null;

// ─── Emit helpers ─────────────────────────────────────────────────────────────

/**
 * Writes a named SSE event frame to a single client.
 * Format: `event: <type>\ndata: <json>\n\n`
 */
function writeNamedEvent(client: Response, payload: SsePayload): void {
  client.write(`event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Broadcasts a raw progress event to all /run/progress subscribers and stores it.
 * Automatically adds `type: 'progress'` and an ISO timestamp.
 */
function emit(
  state: SessionState,
  event: Omit<SseProgressPayload, 'type' | 'timestamp'>,
): void {
  const payload: SseProgressPayload = {
    type: 'progress',
    timestamp: new Date().toISOString(),
    ...event,
  };
  state.progressEvents.push(payload);
  const data = JSON.stringify(payload);
  for (const client of state.progressClients) {
    client.write(`data: ${data}\n\n`);
  }

  // Forward as a typed 'progress' event to /search/events subscribers
  broadcastSemantic(state, payload);

  const msg = `[Agent] ${event.message}`;
  if (event.level === 'error') logger.error(msg);
  else if (event.level === 'warn') logger.warn(msg);
  else logger.info(msg);
}

/**
 * Broadcasts a typed semantic event to all /search/events subscribers and stores it.
 */
function broadcastSemantic(state: SessionState, payload: SsePayload): void {
  state.semanticEvents.push(payload);
  for (const client of state.semanticClients) {
    writeNamedEvent(client, payload);
  }
}

// ─── POST /api/run ────────────────────────────────────────────────────────────

/**
 * POST /api/run
 * Starts the agent pipeline in the background.
 * Returns immediately with { sessionId } — use GET /api/run/progress for SSE updates.
 */
agentRouter.post('/run', async (req: Request, res: Response) => {
  if (session?.running) {
    res.status(409).json({ error: 'Agent is already running. Wait for the current session to finish.' });
    return;
  }

  const sessionId = `session_${Date.now()}`;

  // If config is supplied in the request body, save it first
  const body = req.body as Record<string, unknown>;
  if (body.config) {
    try {
      const yamlStr = yaml.dump(body.config, { indent: 2 });
      await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
      await fs.writeFile(CONFIG_PATH, yamlStr, 'utf-8');
      logger.info('Config saved from POST /api/run body');
    } catch (err) {
      logger.warn(`Could not save config from body: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  session = {
    sessionId,
    running: true,
    progressEvents: [],
    semanticEvents: [],
    counters: { found: 0, applied: 0, skipped: 0 },
    progressClients: [],
    semanticClients: [],
  };

  // Start pipeline asynchronously (fire-and-forget)
  runPipeline(session).catch((err: unknown) => {
    logger.error(`Pipeline error: ${err instanceof Error ? err.message : String(err)}`);
  });

  res.json({ sessionId });
});

// ─── GET /api/run/progress ────────────────────────────────────────────────────

/**
 * GET /api/run/progress
 * Server-Sent Events stream of raw pipeline progress.
 * Each unnamed event carries: { step, total, message, level, done? }
 */
agentRouter.get('/run/progress', (req: Request, res: Response) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  if (!session) {
    res.write(`data: ${JSON.stringify({ done: true, error: 'No active session' })}\n\n`);
    res.end();
    return;
  }

  // Replay already-emitted events (late-connect support)
  for (const ev of session.progressEvents) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  if (!session.running) {
    const lastEvent = session.progressEvents[session.progressEvents.length - 1];
    if (!lastEvent?.done) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }
    res.end();
    return;
  }

  session.progressClients.push(res);

  req.on('close', () => {
    if (session) {
      session.progressClients = session.progressClients.filter((c) => c !== res);
    }
  });
});

// ─── GET /api/search/events ───────────────────────────────────────────────────

/**
 * GET /api/search/events
 * Server-Sent Events stream of typed semantic events.
 * Uses named events so the browser can use addEventListener('job_found', …).
 *
 * Event types: job_found | job_applied | job_skipped | session_complete |
 *              captcha_detected | progress
 */
agentRouter.get('/search/events', (req: Request, res: Response) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  if (!session) {
    const noSession = JSON.stringify({
      type: 'session_complete',
      timestamp: new Date().toISOString(),
      success: false,
      totalFound: 0,
      totalApplied: 0,
      totalSkipped: 0,
      durationSeconds: 0,
      error: 'No active session',
    });
    res.write(`event: session_complete\ndata: ${noSession}\n\n`);
    res.end();
    return;
  }

  // Replay stored semantic events for late-connecting clients
  for (const ev of session.semanticEvents) {
    writeNamedEvent(res, ev);
  }

  if (!session.running) {
    res.end();
    return;
  }

  session.semanticClients.push(res);

  req.on('close', () => {
    if (session) {
      session.semanticClients = session.semanticClients.filter((c) => c !== res);
    }
  });
});

// ─── GET /api/report ─────────────────────────────────────────────────────────

/**
 * GET /api/report
 * Returns the session summary and applications as JSON for the report viewer.
 */
agentRouter.get('/report', async (_req: Request, res: Response) => {
  try {
    const [summaryRaw, applicationsRaw] = await Promise.all([
      fs.readFile(path.join(OUTPUT_DIR, 'session-summary.json'), 'utf-8').catch(() => null),
      fs.readFile(path.join(OUTPUT_DIR, 'applications.json'), 'utf-8').catch(() => null),
    ]);

    if (!summaryRaw || !applicationsRaw) {
      res.json({ available: false, message: 'No report found. Run the agent first.' });
      return;
    }

    const summary = JSON.parse(summaryRaw) as SessionSummary;
    const applications = JSON.parse(applicationsRaw) as ApplicationRecord[];

    res.json({ available: true, summary, applications });
  } catch (err) {
    logger.error(`Error loading report: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ available: false, error: 'Failed to load report data' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Merges the user-provided form keywords with role/title keywords derived from
 * the parsed CV profile.  CV-derived keywords are added AFTER the user ones so
 * user intent is preserved; duplicates (case-insensitive) are removed.
 *
 * CV sources:
 *  - profile.headline    → primary role title  (e.g. "Senior Backend Developer")
 *  - headline without seniority prefix         (e.g. "Backend Developer")
 *  - profile.techStack   → individual tech terms (e.g. "Angular", "TypeScript")
 *    up to 6 items, used as standalone search terms to widen the job pool.
 */
function enrichKeywordsFromProfile(
  existingKeywords: string[],
  profile: ProfessionalProfile,
): string[] {
  const seen = new Set(existingKeywords.map((k) => k.toLowerCase()));
  const derived: string[] = [];

  const headline = profile.headline?.trim();
  if (headline) {
    if (!seen.has(headline.toLowerCase())) {
      derived.push(headline);
      seen.add(headline.toLowerCase());
    }
    // Also add variant without leading seniority word
    const noSeniority = headline
      .replace(/^(senior|junior|mid|lead|principal|staff|director)\s+/i, '')
      .trim();
    if (noSeniority !== headline && !seen.has(noSeniority.toLowerCase())) {
      derived.push(noSeniority);
      seen.add(noSeniority.toLowerCase());
    }
  }

  // Add top tech stack items as individual keywords (max 6).
  // These are short, precise terms (e.g. "Angular", "TypeScript", "Node.js")
  // that dramatically widen the job pool in platforms that filter by title/tags.
  const techStack = profile.techStack ?? [];
  for (const tech of techStack.slice(0, 6)) {
    const key = tech.toLowerCase().trim();
    if (key.length > 2 && !seen.has(key)) {
      derived.push(tech.trim());
      seen.add(key);
    }
  }

  return [...existingKeywords, ...derived];
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 8;

/**
 * Runs the full agent pipeline:
 *  1. Load config
 *  2. Find CV
 *  3. Parse CV
 *  4. Search jobs (multi-platform)
 *  5. Score & filter jobs
 *  6. Apply (LinkedIn Easy Apply)
 *  7. Save output files
 *  8. Generate report
 */
async function runPipeline(state: SessionState): Promise<void> {
  const sessionStartedAt = new Date().toISOString();
  const startTime = Date.now();

  try {
    // ── Step 1: Load config ───────────────────────────────────────────────────
    emit(state, { step: 1, total: TOTAL_STEPS, message: 'Loading configuration...', level: 'info' });

    let config: AppConfig;
    try {
      const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
      config = yaml.load(raw) as AppConfig;
      emit(state, { step: 1, total: TOTAL_STEPS, message: 'Configuration loaded', level: 'success' });
    } catch {
      emit(state, { step: 1, total: TOTAL_STEPS, message: 'config.yaml not found', level: 'error', done: true, error: 'No config.yaml found. Please fill in the form first.' });
      state.running = false;
      closeSseClients(state);
      return;
    }

    // ── Step 2: Find CV ───────────────────────────────────────────────────────
    emit(state, { step: 2, total: TOTAL_STEPS, message: 'Looking for CV file...', level: 'info' });

    let cvPath: string;
    try {
      await fs.mkdir(CV_DIR, { recursive: true });
      const files = await fs.readdir(CV_DIR);
      const cvFiles = files.filter((f) => /\.(pdf|docx)$/i.test(f));

      if (cvFiles.length === 0) {
        emit(state, { step: 2, total: TOTAL_STEPS, message: 'No CV found. Upload a PDF or DOCX in the form.', level: 'error', done: true, error: 'No CV file found in cv/ directory.' });
        state.running = false;
        closeSseClients(state);
        return;
      }

      cvPath = path.join(CV_DIR, cvFiles[0] ?? '');
      emit(state, { step: 2, total: TOTAL_STEPS, message: `CV found: ${cvFiles[0]}`, level: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit(state, { step: 2, total: TOTAL_STEPS, message: `CV check failed: ${msg}`, level: 'error', done: true, error: msg });
      state.running = false;
      closeSseClients(state);
      return;
    }

    // ── Step 3: Parse CV ──────────────────────────────────────────────────────
    emit(state, { step: 3, total: TOTAL_STEPS, message: 'Parsing CV and building professional profile...', level: 'info' });

    let profile: ProfessionalProfile;
    try {
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      const profileOutputPath = path.join(OUTPUT_DIR, 'profile.json');
      // Dynamic import to avoid circular dependencies at startup
      const { runCvParser } = await import('@job-agent/cv-parser');
      profile = await runCvParser(cvPath, profileOutputPath);
      emit(state, { step: 3, total: TOTAL_STEPS, message: `Profile built: ${profile.fullName} | ${profile.seniority} | ${profile.skills.length} skills`, level: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit(state, { step: 3, total: TOTAL_STEPS, message: `CV parsing failed: ${msg}`, level: 'error', done: true, error: msg });
      state.running = false;
      closeSseClients(state);
      return;
    }

    // ── Step 3.5a: Enrich applicationDefaults with profile data ──────────────
    // If yearsOfExperience was not set in config, derive it from the parsed CV.
    if (profile.yearsOfExperience && config.applicationDefaults !== undefined) {
      if (config.applicationDefaults.yearsOfExperience === undefined) {
        config = {
          ...config,
          applicationDefaults: {
            ...config.applicationDefaults,
            yearsOfExperience: profile.yearsOfExperience,
          },
        };
      }
    }

    // ── Step 3.5: Enrich keywords from CV profile ─────────────────────────────
    {
      const before = config.search.keywords.length;
      const enriched = enrichKeywordsFromProfile(config.search.keywords, profile);
      if (enriched.length > before) {
        const added = enriched.slice(before);
        emit(state, { step: 3, total: TOTAL_STEPS, message: `CV keywords added: ${added.join(', ')}`, level: 'info' });
      }
      // If no keywords at all (user left form empty), fall back to headline only
      const finalKeywords = enriched.length > 0 ? enriched : [profile.headline ?? 'Software Engineer'];
      config = { ...config, search: { ...config.search, keywords: finalKeywords } };
      emit(state, { step: 3, total: TOTAL_STEPS, message: `Searching with keywords: ${finalKeywords.join(', ')}`, level: 'info' });
    }

    // ── Step 4: Multi-platform job search ─────────────────────────────────────
    emit(state, { step: 4, total: TOTAL_STEPS, message: `Searching jobs on platforms: ${(config.search.platforms ?? ['linkedin']).join(', ')}`, level: 'info' });

    let allJobs: JobListing[];
    try {
      const { runMultiPlatformSearch } = await import('@job-agent/job-search');
      const selectedPlatforms = config.search.platforms ?? ['linkedin'];
      const maxJobsToFind = config.search.maxJobsToFind ?? 100;
      const maxPerPlatform = Math.ceil(maxJobsToFind / Math.max(1, selectedPlatforms.length));
      allJobs = await runMultiPlatformSearch(config, maxPerPlatform, (msg) => {
        emit(state, { step: 4, total: TOTAL_STEPS, message: msg, level: 'info' });
      });
      // Emit a job_found semantic event for each discovered job
      for (const job of allJobs) {
        state.counters.found++;
        broadcastSemantic(state, {
          type: 'job_found',
          timestamp: new Date().toISOString(),
          jobId: job.id,
          title: job.title,
          company: job.company,
          platform: job.platform,
          score: job.compatibilityScore,
          totalFound: state.counters.found,
        });
      }
      emit(state, { step: 4, total: TOTAL_STEPS, message: `Found ${allJobs.length} jobs total`, level: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit(state, { step: 4, total: TOTAL_STEPS, message: `Job search failed: ${msg}`, level: 'error', done: true, error: msg });
      state.running = false;
      closeSseClients(state);
      return;
    }

    // ── Step 5: Score & filter ────────────────────────────────────────────────
    emit(state, { step: 5, total: TOTAL_STEPS, message: 'Scoring and ranking jobs...', level: 'info' });

    let scoredJobs: JobListing[];
    try {
      const { rankJobs } = await import('@job-agent/linkedin-mcp/scoring');
      // Score ALL jobs (minScore=0) so every job appears in the report.
      // The minScoreToApply threshold is only used when deciding whether to Easy Apply.
      scoredJobs = rankJobs(allJobs, profile, 0);

      const minScore = config.matching.minScoreToApply;
      const high  = scoredJobs.filter((j) => j.compatibilityScore >= 80).length;
      const med   = scoredJobs.filter((j) => j.compatibilityScore >= 60 && j.compatibilityScore < 80).length;
      const low   = scoredJobs.filter((j) => j.compatibilityScore < 60).length;
      const above = scoredJobs.filter((j) => j.compatibilityScore >= minScore).length;
      emit(state, { step: 5, total: TOTAL_STEPS, message: `Scored ${scoredJobs.length} jobs: ${high} high / ${med} med / ${low} low — ${above} above threshold (${minScore})`, level: 'success' });
    } catch (err) {
      // If scoring fails, use all jobs with score 0 — non-fatal
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Scoring failed (continuing): ${msg}`);
      scoredJobs = allJobs;
      emit(state, { step: 5, total: TOTAL_STEPS, message: `Scoring skipped (${msg})`, level: 'warn' });
    }

    // Save jobs-found.json
    await fs.writeFile(path.join(OUTPUT_DIR, 'jobs-found.json'), JSON.stringify(scoredJobs, null, 2), 'utf-8');

    // ── Step 6: Apply — LinkedIn Easy Apply + ATS APIs (Greenhouse / Lever) ──
    emit(state, { step: 6, total: TOTAL_STEPS, message: 'Starting applications (LinkedIn Easy Apply + ATS APIs)...', level: 'info' });

    const applications: ApplicationRecord[] = [];
    const minScore  = config.matching.minScoreToApply;
    const maxApps   = config.matching.maxApplicationsPerSession;

    // ── 6a. LinkedIn Easy Apply ────────────────────────────────────────────
    //
    // The HTTP-based LinkedIn guest API is frequently blocked by LinkedIn and
    // returns 0 results. Because of this, we do NOT rely on `scoredJobs` to
    // decide whether to run LinkedIn: we run the Playwright-based agent whenever
    // the user has selected LinkedIn as a platform, regardless of what the
    // HTTP search found.
    const linkedinSelected = (config.search.platforms ?? []).includes('linkedin');

    if (linkedinSelected) {
      emit(state, { step: 6, total: TOTAL_STEPS, message: 'Searching LinkedIn + Easy Apply via browser (uses your .env credentials)...', level: 'info' });
      try {
        const { runLinkedInAgent } = await import('@job-agent/linkedin-mcp/agent');
        const result = await runLinkedInAgent({ config, profile, maxResults: maxApps * 3 });
        for (const rec of result.applications) {
          // Avoid duplicates if the HTTP search happened to find some LinkedIn jobs
          if (!applications.find((a) => a.job.id === rec.job.id)) {
            applications.push({ ...rec, applicationMethod: 'linkedin_easy_apply' });
          }
        }
        const liApplied = result.applications.filter((r) => r.status === 'applied').length;
        emit(state, { step: 6, total: TOTAL_STEPS, message: `LinkedIn Easy Apply: ${liApplied} applied`, level: 'success' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit(state, { step: 6, total: TOTAL_STEPS, message: `LinkedIn Easy Apply failed: ${msg}`, level: 'warn' });
      }
    } else {
      emit(state, { step: 6, total: TOTAL_STEPS, message: 'LinkedIn not selected — skipping Easy Apply', level: 'info' });
    }

    // ── 6b. ATS API Apply (Greenhouse + Lever) ─────────────────────────────
    const appliedSoFar = applications.filter((a) => a.status === 'applied').length;
    const atsSlots     = Math.max(0, maxApps - appliedSoFar);

    if (atsSlots > 0) {
      const { applyToAts } = await import('@job-agent/ats-apply');
      const { detectAts }  = await import('@job-agent/ats-apply');

      // Collect jobs not yet processed that are above the score threshold
      // AND whose URL points to a supported ATS
      const atsEligible = scoredJobs
        .filter((j) => {
          if (applications.find((a) => a.job.id === j.id)) return false;
          if (j.compatibilityScore < minScore) return false;
          return detectAts(j.applyUrl) !== null;
        })
        .slice(0, atsSlots);

      emit(state, { step: 6, total: TOTAL_STEPS, message: `${atsEligible.length} ATS jobs detected (Greenhouse / Lever)`, level: 'info' });

      let atsApplied = 0;
      let atsFailed  = 0;

      for (const job of atsEligible) {
        try {
          const result = await applyToAts({ job, profile, cvPath, config });
          if (result) {
            applications.push({
              job,
              status:            result.status,
              appliedAt:         new Date().toISOString(),
              applicationMethod: result.method,
              ...(result.confirmationId !== undefined ? { confirmationId: result.confirmationId } : {}),
            });
            if (result.status === 'applied') {
              atsApplied++;
              state.counters.applied++;
              const confirmStr = result.confirmationId ? ` [ID: ${result.confirmationId}]` : '';
              emit(state, { step: 6, total: TOTAL_STEPS, message: `✓ Applied via ${result.method}: ${job.title} @ ${job.company}${confirmStr}`, level: 'success' });
              broadcastSemantic(state, {
                type: 'job_applied',
                timestamp: new Date().toISOString(),
                jobId: job.id,
                title: job.title,
                company: job.company,
                method: result.method,
                totalApplied: state.counters.applied,
              });
            } else {
              state.counters.skipped++;
              emit(state, { step: 6, total: TOTAL_STEPS, message: `Already applied: ${job.title} @ ${job.company}`, level: 'info' });
              broadcastSemantic(state, {
                type: 'job_skipped',
                timestamp: new Date().toISOString(),
                jobId: job.id,
                title: job.title,
                company: job.company,
                reason: 'already_applied',
                totalSkipped: state.counters.skipped,
              });
            }
          } else {
            // detectAts returned null after initial check — shouldn't happen but handle gracefully
            applications.push({ job, status: 'easy_apply_not_available', appliedAt: new Date().toISOString() });
          }
        } catch (err) {
          atsFailed++;
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(`ATS apply error for ${job.title}: ${msg}`);
          applications.push({ job, status: 'failed', appliedAt: new Date().toISOString(), errorMessage: msg });
          emit(state, { step: 6, total: TOTAL_STEPS, message: `ATS apply failed: ${job.title} — ${msg.slice(0, 80)}`, level: 'warn' });
        }

        // Respect rate limit between applications
        if (atsEligible.indexOf(job) < atsEligible.length - 1) {
          await new Promise<void>((r) => setTimeout(r, 3000 + Math.random() * 2000));
        }
      }

      if (atsEligible.length > 0) {
        emit(state, { step: 6, total: TOTAL_STEPS, message: `ATS total: ${atsApplied} applied, ${atsFailed} failed`, level: 'success' });
      }
    }

    // ── 6c. Fill remaining jobs with appropriate status ────────────────────
    for (const job of scoredJobs) {
      if (applications.find((a) => a.job.id === job.id)) continue;

      if (job.compatibilityScore < minScore) {
        applications.push({ job, status: 'skipped_low_score', appliedAt: new Date().toISOString() });
        state.counters.skipped++;
        broadcastSemantic(state, {
          type: 'job_skipped',
          timestamp: new Date().toISOString(),
          jobId: job.id,
          title: job.title,
          company: job.company,
          reason: 'low_score',
          totalSkipped: state.counters.skipped,
        });
      } else {
        // Above threshold but no automated method available — user applies manually
        applications.push({ job, status: 'easy_apply_not_available', appliedAt: new Date().toISOString() });
        state.counters.skipped++;
        broadcastSemantic(state, {
          type: 'job_skipped',
          timestamp: new Date().toISOString(),
          jobId: job.id,
          title: job.title,
          company: job.company,
          reason: 'no_method',
          totalSkipped: state.counters.skipped,
        });
      }
    }

    // ── Step 7: Save output files ─────────────────────────────────────────────
    emit(state, { step: 7, total: TOTAL_STEPS, message: 'Saving output files...', level: 'info' });

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    const applied  = applications.filter((r) => r.status === 'applied').length;
    const skipped  = applications.filter((r) => r.status === 'skipped_low_score').length;
    const manual   = applications.filter((r) => r.status === 'easy_apply_not_available').length;
    const failed   = applications.filter((r) => r.status === 'failed').length;

    const summary: SessionSummary = {
      totalFound:   allJobs.length,
      totalScored:  scoredJobs.length,
      totalApplied: applied,
      totalSkipped: skipped,
      totalManual:  manual,
      totalFailed:  failed,
      sessionStartedAt,
      sessionEndedAt: new Date().toISOString(),
      durationSeconds,
    };

    await Promise.all([
      fs.writeFile(path.join(OUTPUT_DIR, 'applications.json'), JSON.stringify(applications, null, 2), 'utf-8'),
      fs.writeFile(path.join(OUTPUT_DIR, 'session-summary.json'), JSON.stringify(summary, null, 2), 'utf-8'),
    ]);

    emit(state, { step: 7, total: TOTAL_STEPS, message: 'Output files saved', level: 'success' });

    // ── Step 8: Generate report ───────────────────────────────────────────────
    emit(state, { step: 8, total: TOTAL_STEPS, message: 'Generating session report...', level: 'info' });

    try {
      const { generateReport } = await import('@job-agent/reporter');
      await generateReport({ records: applications, summary, profile, format: config.report?.format ?? 'both', outputDir: OUTPUT_DIR });
      emit(state, { step: 8, total: TOTAL_STEPS, message: 'Report generated successfully', level: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit(state, { step: 8, total: TOTAL_STEPS, message: `Report generation failed: ${msg}`, level: 'warn' });
    }

    // ── Done ──────────────────────────────────────────────────────────────────
    emit(state, {
      step: TOTAL_STEPS,
      total: TOTAL_STEPS,
      message: `Session complete! Applied: ${applied} | Found: ${allJobs.length} | Duration: ${Math.round(durationSeconds / 60)}m`,
      level: 'success',
      done: true,
    });

    broadcastSemantic(state, {
      type: 'session_complete',
      timestamp: new Date().toISOString(),
      success: true,
      totalFound: allJobs.length,
      totalApplied: applied,
      totalSkipped: skipped + manual,
      durationSeconds,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(state, { step: 0, total: TOTAL_STEPS, message: `Fatal error: ${msg}`, level: 'error', done: true, error: msg });
    broadcastSemantic(state, {
      type: 'session_complete',
      timestamp: new Date().toISOString(),
      success: false,
      totalFound: 0,
      totalApplied: state.counters.applied,
      totalSkipped: state.counters.skipped,
      durationSeconds: Math.round((Date.now() - startTime) / 1000),
      error: msg,
    });
  } finally {
    state.running = false;
    closeSseClients(state);
  }
}

/** Closes all SSE client connections (both progress and semantic). */
function closeSseClients(state: SessionState): void {
  for (const client of [...state.progressClients, ...state.semanticClients]) {
    try { client.end(); } catch { /* ignore */ }
  }
  state.progressClients = [];
  state.semanticClients = [];
}
