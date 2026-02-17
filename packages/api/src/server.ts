/**
 * @job-agent/api — Express REST API Server
 *
 * Provides endpoints for:
 *   - GET/POST /api/config  — read and write config.yaml
 *   - GET      /api/cv      — check uploaded CV
 *   - POST     /api/cv/upload — upload a new CV
 *   - GET      /api/jobs    — view discovered jobs and applications
 *
 * Designed to be frontend-agnostic: works with the vanilla HTML UI today
 * and can be consumed by React/Angular/Vue without any backend changes.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { configRouter } from './routes/config.routes.js';
import { cvRouter } from './routes/cv.routes.js';
import { jobsRouter } from './routes/jobs.routes.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js';
import { logger } from './utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env['API_PORT'] ?? '3000', 10);
const HOST = process.env['API_HOST'] ?? 'localhost';

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static UI files
const uiPath = path.resolve(__dirname, '../../../apps/ui');
app.use(express.static(uiPath));

// Serve output directory for report viewing
const outputPath = process.env['OUTPUT_DIR'] ?? path.resolve('./output');
app.use('/output', express.static(outputPath));

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/config', configRouter);
app.use('/api/cv', cvRouter);
app.use('/api/jobs', jobsRouter);

/** Health check */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error handling ───────────────────────────────────────────────────────────

app.use(notFoundMiddleware);
app.use(errorMiddleware);

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
  logger.info(`API Server running at http://${HOST}:${PORT}`);
  logger.info(`UI available at: http://${HOST}:${PORT}/index.html`);
});

export { app };
