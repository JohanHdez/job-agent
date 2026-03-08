import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import type { AppConfig } from '@job-agent/core';
import { ApiError } from '../middleware/error.middleware.js';
import { logger } from '../utils/logger.js';

const CONFIG_PATH = process.env['CONFIG_PATH'] ?? path.resolve('./config.yaml');

export const configRouter = Router();

/**
 * GET /api/config
 * Returns the current config.yaml as a JSON object.
 */
configRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = yaml.load(raw) as AppConfig;
    res.json({ config });
  } catch {
    // Config file doesn't exist yet — return defaults
    res.json({ config: null, message: 'No config found. Please submit the form.' });
  }
});

/**
 * POST /api/config
 * Accepts AppConfig as JSON and writes it to config.yaml.
 */
configRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as unknown;

  if (typeof body !== 'object' || body === null) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  const config = body as AppConfig;

  // Basic validation — keywords are optional (auto-derived from CV profile)
  if (!Array.isArray(config.search?.keywords)) {
    throw new ApiError(400, 'search.keywords must be an array');
  }

  if (typeof config.matching?.minScoreToApply !== 'number') {
    throw new ApiError(400, 'matching.minScoreToApply must be a number');
  }

  const yamlStr = yaml.dump(config, { indent: 2 });
  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CONFIG_PATH, yamlStr, 'utf-8');

  logger.info(`Config saved to ${CONFIG_PATH}`);
  res.json({ success: true, message: 'Configuration saved successfully' });
});
