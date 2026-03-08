#!/usr/bin/env node
/**
 * Job Agent CLI — Server Launcher (v2)
 *
 * Starts the Express API server and opens the browser at http://localhost:3000.
 * The complete agent pipeline (CV parsing, job search, applications, report)
 * runs server-side when the user clicks "Start Search" in the UI.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env['API_PORT'] ?? '3000', 10);
const API_URL = `http://localhost:${PORT}`;

process.stdout.write(chalk.bold.hex('#6366f1')('\n  🤖 Job Agent v2 — Multi-Platform Job Search\n') + '\n');

// Resolve the built server entry point (relative to this file in dist/)
const serverPath = path.resolve(__dirname, '../../../packages/api/dist/server.js');

process.stdout.write(chalk.blue('[INFO]') + ' Starting API server...\n');

const serverProc = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: { ...process.env },
  detached: false,
});

serverProc.on('error', (err) => {
  process.stderr.write(chalk.red('[ERROR]') + ` Failed to start server: ${err.message}\n`);
  process.stderr.write(chalk.yellow('[HINT]') + ' Run `npm run build` first to compile the project.\n');
  process.exit(1);
});

// Give the server a moment to start, then open the browser
setTimeout(async () => {
  process.stdout.write(chalk.green('[OK]') + ` Opening ${chalk.cyan(API_URL)} in your browser...\n`);
  process.stdout.write(chalk.gray('       Upload your CV, configure search settings, select platforms,') + '\n');
  process.stdout.write(chalk.gray('       and click "Start Search" — no terminal interaction needed.\n\n'));

  await open(API_URL).catch(() => {
    process.stdout.write(chalk.yellow('[WARN]') + ` Could not open browser automatically. Open ${chalk.cyan(API_URL)} manually.\n`);
  });
}, 1_500);

// Keep the process alive (the server is the main process)
process.on('SIGINT', () => {
  process.stdout.write(chalk.yellow('\n[WARN] Shutting down...\n'));
  serverProc.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  serverProc.kill();
  process.exit(0);
});
