import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import type { JobListing, ApplicationRecord, SessionSummary } from '@job-agent/core';
import { logger } from '../utils/logger.js';

const OUTPUT_DIR = process.env['OUTPUT_DIR'] ?? path.resolve('./output');

export const jobsRouter = Router();

/**
 * GET /api/jobs
 * Returns the jobs found during the last session.
 */
jobsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const raw = await fs.readFile(path.join(OUTPUT_DIR, 'jobs-found.json'), 'utf-8');
    const jobs = JSON.parse(raw) as JobListing[];
    res.json({ jobs, count: jobs.length });
  } catch {
    res.json({ jobs: [], count: 0, message: 'No jobs found yet. Run the agent first.' });
  }
});

/**
 * GET /api/jobs/applications
 * Returns all application records from the last session.
 */
jobsRouter.get('/applications', async (_req: Request, res: Response) => {
  try {
    const raw = await fs.readFile(path.join(OUTPUT_DIR, 'applications.json'), 'utf-8');
    const records = JSON.parse(raw) as ApplicationRecord[];
    const summary = {
      total: records.length,
      applied: records.filter((r) => r.status === 'applied').length,
      failed: records.filter((r) => r.status === 'failed').length,
      skipped: records.filter((r) => r.status === 'skipped_low_score').length,
    };
    res.json({ records, summary });
  } catch {
    res.json({ records: [], summary: null, message: 'No applications yet.' });
  }
});

/**
 * GET /api/jobs/summary
 * Returns the session summary from the last agent run.
 */
jobsRouter.get('/summary', async (_req: Request, res: Response) => {
  try {
    const raw = await fs.readFile(path.join(OUTPUT_DIR, 'session-summary.json'), 'utf-8');
    const summary = JSON.parse(raw) as SessionSummary;
    res.json({ summary });
  } catch {
    res.json({ summary: null, message: 'No session summary yet.' });
  }
});

/**
 * GET /api/jobs/report
 * Returns the path to the generated HTML report.
 */
jobsRouter.get('/report', async (_req: Request, res: Response) => {
  const reportPath = path.join(OUTPUT_DIR, 'report.html');
  try {
    await fs.access(reportPath);
    res.json({ available: true, path: reportPath });
  } catch {
    res.json({ available: false, message: 'Report not generated yet.' });
  }
});

logger.debug('Jobs router initialized');
