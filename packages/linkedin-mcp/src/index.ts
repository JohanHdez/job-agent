#!/usr/bin/env node
/**
 * @job-agent/linkedin-mcp
 *
 * MCP Server exposing LinkedIn automation tools via the Model Context Protocol.
 *
 * Exposed tools:
 *   - search_jobs       Search LinkedIn for jobs matching a profile and config
 *   - get_job_details   Fetch full description for a specific job ID
 *   - easy_apply        Submit an Easy Apply application for a job
 *   - check_rate_limit  Check if we should pause (CAPTCHA/unusual activity)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import type { AppConfig, LinkedInCredentials, JobListing } from '@job-agent/core';
import { LinkedInSession } from './browser/linkedin.session.js';
import { searchJobs } from './tools/search-jobs.tool.js';
import { getJobDetails } from './tools/get-job-details.tool.js';
import { easyApply } from './tools/easy-apply.tool.js';
import { rankJobs } from './scoring/job-matcher.js';
import { logger } from './utils/logger.js';

dotenv.config();

/** Global session — reused across tool calls within the same MCP server process */
const session = new LinkedInSession();
let sessionInitialized = false;

/**
 * Ensures the LinkedIn session is started. Called lazily on first tool use.
 */
async function ensureSession(): Promise<void> {
  if (sessionInitialized) return;

  const credentials: LinkedInCredentials = {
    email: process.env['LINKEDIN_EMAIL'] ?? '',
    password: process.env['LINKEDIN_PASSWORD'] ?? '',
  };

  if (!credentials.email || !credentials.password) {
    throw new Error('LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in .env');
  }

  const headless = process.env['HEADLESS'] !== 'false';
  const slowMo = parseInt(process.env['SLOW_MO'] ?? '50', 10);

  await session.initialize(credentials, headless, slowMo);
  sessionInitialized = true;
}

/** MCP Server definition */
const server = new Server(
  { name: 'linkedin-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ─── List Tools ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_jobs',
      description: 'Search LinkedIn for jobs matching the given config and return a scored list',
      inputSchema: {
        type: 'object' as const,
        properties: {
          config: { type: 'object', description: 'AppConfig object with search filters' },
          profile: { type: 'object', description: 'ProfessionalProfile for scoring' },
          maxResults: { type: 'number', description: 'Max jobs to collect (default 50)' },
        },
        required: ['config', 'profile'],
      },
    },
    {
      name: 'get_job_details',
      description: 'Fetch the full job description and required skills for a job ID',
      inputSchema: {
        type: 'object' as const,
        properties: {
          job: { type: 'object', description: 'JobListing with at least an id field' },
        },
        required: ['job'],
      },
    },
    {
      name: 'easy_apply',
      description: 'Execute the LinkedIn Easy Apply flow for a specific job',
      inputSchema: {
        type: 'object' as const,
        properties: {
          job: { type: 'object', description: 'JobListing to apply to' },
          phoneNumber: { type: 'string', description: 'Optional phone number for the form' },
        },
        required: ['job'],
      },
    },
    {
      name: 'check_rate_limit',
      description: 'Check if LinkedIn is showing a CAPTCHA or unusual activity warning',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ],
}));

// ─── Call Tools ──────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    await ensureSession();
    const page = session.getPage();

    switch (name) {
      case 'search_jobs': {
        const config = args?.['config'] as AppConfig;
        const profile = args?.['profile'] as Parameters<typeof rankJobs>[1];
        const maxResults = (args?.['maxResults'] as number | undefined) ?? 50;

        const rawJobs = await searchJobs(page, config, maxResults);
        const scored = rankJobs(rawJobs, profile, 0);

        return {
          content: [{ type: 'text', text: JSON.stringify(scored, null, 2) }],
        };
      }

      case 'get_job_details': {
        const job = args?.['job'] as JobListing;
        const detailed = await getJobDetails(page, job);
        return {
          content: [{ type: 'text', text: JSON.stringify(detailed, null, 2) }],
        };
      }

      case 'easy_apply': {
        const job = args?.['job'] as JobListing;
        const phoneNumber = args?.['phoneNumber'] as string | undefined;
        const record = await easyApply(page, job, phoneNumber);
        return {
          content: [{ type: 'text', text: JSON.stringify(record, null, 2) }],
        };
      }

      case 'check_rate_limit': {
        const hasChallenge = await session.checkForChallenge();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ shouldPause: hasChallenge }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Tool "${name}" failed: ${message}`);

    if (message === 'LINKEDIN_CHALLENGE_DETECTED') {
      await session.close();
      sessionInitialized = false;
    }

    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  logger.info('Shutting down MCP server...');
  await session.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

// ─── Start server ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('LinkedIn MCP Server started. Listening for tool calls via stdio...');
}

main().catch((err: unknown) => {
  logger.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
