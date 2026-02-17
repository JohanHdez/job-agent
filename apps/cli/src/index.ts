#!/usr/bin/env node
/**
 * Job Agent CLI — Main Orchestrator
 *
 * Execution Flow:
 *  1. Check that cv/ has exactly one PDF/DOCX file
 *  2. Check that config.yaml exists — open UI if not
 *  3. Parse CV → generate output/profile.json
 *  4. Initialize LinkedIn browser session
 *  5. Search jobs using profile keywords + config filters
 *  6. Score each job for compatibility against profile
 *  7. Filter jobs above minScoreToApply
 *  8. Apply to filtered jobs up to maxApplicationsPerSession
 *  9. Log each application to output/applications.json
 * 10. Generate output/report.md and/or output/report.html
 * 11. Open output/report.html in the default browser
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import yaml from 'js-yaml';
import chalk from 'chalk';
import open from 'open';
import dotenv from 'dotenv';
import type { AppConfig, ProfessionalProfile, SessionSummary } from '@job-agent/core';
import { runCvParser } from '@job-agent/cv-parser';
import { runLinkedInAgent } from '@job-agent/linkedin-mcp/agent';
import { generateReport } from '@job-agent/reporter';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Paths ────────────────────────────────────────────────────────────────────

const CV_DIR = path.resolve(process.env['CV_DIR'] ?? './cv');
const OUTPUT_DIR = path.resolve(process.env['OUTPUT_DIR'] ?? './output');
const CONFIG_PATH = path.resolve(process.env['CONFIG_PATH'] ?? './config.yaml');

// ─── Logger ───────────────────────────────────────────────────────────────────

function log(level: 'info' | 'success' | 'warn' | 'error', message: string): void {
  const prefix =
    level === 'info'    ? chalk.blue('[INFO]')    :
    level === 'success' ? chalk.green('[OK]')      :
    level === 'warn'    ? chalk.yellow('[WARN]')   :
                          chalk.red('[ERROR]');
  console.log(`${chalk.gray(new Date().toISOString())} ${prefix} ${message}`);
}

function step(n: number, total: number, description: string): void {
  console.log(
    `\n${chalk.bgHex('#6366f1').white(` STEP ${n}/${total} `)} ${chalk.bold(description)}`
  );
}

// ─── Step 1: Check CV ─────────────────────────────────────────────────────────

async function checkCvDirectory(): Promise<string> {
  await fs.mkdir(CV_DIR, { recursive: true });
  const files = await fs.readdir(CV_DIR);
  const cvFiles = files.filter((f) => /\.(pdf|docx)$/i.test(f));

  if (cvFiles.length === 0) {
    log('error', `No CV found in ${CV_DIR}/`);
    log('info', 'Please drop your PDF or DOCX resume into the cv/ directory and run again.');
    process.exit(1);
  }

  if (cvFiles.length > 1) {
    log('warn', `Multiple CV files found. Using: ${cvFiles[0]}`);
  }

  const cvPath = path.join(CV_DIR, cvFiles[0]!);
  log('success', `CV found: ${cvFiles[0]}`);
  return cvPath;
}

// ─── Step 2: Check Config ─────────────────────────────────────────────────────

async function checkConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = yaml.load(raw) as AppConfig;
    log('success', `Config loaded from ${CONFIG_PATH}`);
    return config;
  } catch {
    log('warn', 'config.yaml not found. Starting API server and opening UI...');

    // Start the API server so the UI form can save config.yaml
    const apiDist = path.resolve(__dirname, '../../../packages/api/dist/server.js');
    const apiProc = spawn('node', [apiDist], {
      stdio: 'inherit',
      env: { ...process.env },
      detached: false,
    });

    // Give the server a moment to start
    await new Promise((r) => setTimeout(r, 1_500));

    await open('http://localhost:3000/index.html');
    log('info', chalk.cyan('Fill out the form in your browser and click "Save Configuration".'));
    log('info', chalk.cyan('Then press ENTER here to continue...'));

    // Wait for user to press Enter (config saved via UI)
    await new Promise<void>((resolve) => {
      process.stdin.setEncoding('utf8');
      process.stdin.once('data', () => resolve());
    });

    apiProc.kill();

    // Retry loading config
    try {
      const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
      const config = yaml.load(raw) as AppConfig;
      log('success', 'Config loaded successfully');
      return config;
    } catch {
      log('error', 'Still no config.yaml found. Please fill out the form and try again.');
      process.exit(1);
    }
  }
}

// ─── Step 3: Parse CV ─────────────────────────────────────────────────────────

async function parseCv(cvPath: string): Promise<ProfessionalProfile> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, 'profile.json');
  const profile = await runCvParser(cvPath, outputPath);
  log('success', `Profile extracted: ${profile.fullName} | ${profile.seniority} | ${profile.techStack.length} tech skills`);
  return profile;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(chalk.bold.hex('#6366f1')('\n  🤖 Job Agent — LinkedIn Automation\n'));

  const sessionStartedAt = new Date().toISOString();
  const startTime = Date.now();

  try {
    // ── Step 1 ────────────────────────────────────────────────────────────────
    step(1, 11, 'Checking CV directory...');
    const cvPath = await checkCvDirectory();

    // ── Step 2 ────────────────────────────────────────────────────────────────
    step(2, 11, 'Loading configuration...');
    const config = await checkConfig();

    // ── Step 3 ────────────────────────────────────────────────────────────────
    step(3, 11, 'Parsing CV and building profile...');
    const profile = await parseCv(cvPath);

    // ── Steps 4–9: LinkedIn search + apply (direct import) ───────────────────
    step(4, 11, 'Connecting to LinkedIn...');
    log('info', 'Launching browser session (this may take 30–60 seconds)...');

    step(5, 11, 'Searching LinkedIn for matching jobs...');

    const { jobs, applications } = await runLinkedInAgent({
      config,
      profile,
      maxResults: config.matching.maxApplicationsPerSession * 3,
    });

    step(6, 11, 'Jobs scored and ranked');
    const high = jobs.filter((j) => j.compatibilityScore >= 80).length;
    const med  = jobs.filter((j) => j.compatibilityScore >= 60 && j.compatibilityScore < 80).length;
    const low  = jobs.filter((j) => j.compatibilityScore < 60).length;
    log('info', `Score distribution: ${high} high ≥80, ${med} medium 60–79, ${low} low <60`);

    step(7, 11, 'Jobs filtered by minimum score');
    const eligible = jobs.filter((j) => j.compatibilityScore >= config.matching.minScoreToApply);
    log('info', `${eligible.length} eligible (≥ ${config.matching.minScoreToApply})`);

    step(8, 11, 'Applications submitted');
    const applied  = applications.filter((r) => r.status === 'applied').length;
    const skipped  = applications.filter((r) => r.status === 'skipped_low_score').length;
    const failed   = applications.filter((r) => r.status === 'failed').length;
    log('success', `Applied: ${applied}  Skipped: ${skipped}  Failed: ${failed}`);

    step(9, 11, 'Saving output files...');
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'jobs-found.json'),
      JSON.stringify(jobs, null, 2), 'utf-8'
    );
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'applications.json'),
      JSON.stringify(applications, null, 2), 'utf-8'
    );

    // ── Step 10: Generate Report ──────────────────────────────────────────────
    step(10, 11, 'Generating report...');
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    const summary: SessionSummary = {
      totalFound:   jobs.length,
      totalScored:  jobs.length,
      totalApplied: applied,
      totalSkipped: skipped,
      totalFailed:  failed,
      sessionStartedAt,
      sessionEndedAt: new Date().toISOString(),
      durationSeconds,
    };

    await fs.writeFile(
      path.join(OUTPUT_DIR, 'session-summary.json'),
      JSON.stringify(summary, null, 2), 'utf-8'
    );

    const reportPaths = await generateReport({
      records: applications,
      summary,
      profile,
      format: config.report.format,
      outputDir: OUTPUT_DIR,
    });

    // ── Step 11: Open Report ──────────────────────────────────────────────────
    step(11, 11, 'Opening report in browser...');
    if (reportPaths.html) {
      await open(reportPaths.html);
    }

    console.log(chalk.bold.green('\n  ✅ Session complete!\n'));
    console.log(`  📊 Applied:  ${chalk.bold.green(String(summary.totalApplied))} jobs`);
    console.log(`  🔍 Found:    ${chalk.cyan(String(summary.totalFound))} jobs`);
    console.log(`  ⏭️  Skipped:  ${chalk.yellow(String(summary.totalSkipped))} (low score)`);
    console.log(`  ❌ Failed:   ${chalk.red(String(summary.totalFailed))}`);
    console.log(`  ⏱️  Duration: ${Math.round(durationSeconds / 60)} minutes\n`);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', `Fatal error: ${message}`);
    if (err instanceof Error && err.stack) {
      log('error', err.stack);
    }
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(chalk.red('Unhandled error:'), err);
  process.exit(1);
});
