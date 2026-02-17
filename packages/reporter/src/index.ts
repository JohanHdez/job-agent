/**
 * @job-agent/reporter
 *
 * Generates Markdown and/or HTML reports from session data.
 *
 * Usage:
 *   import { generateReport } from '@job-agent/reporter';
 *   await generateReport({ records, summary, profile, format: 'both', outputDir: './output' });
 */

import fs from 'fs/promises';
import path from 'path';
import type { ApplicationRecord, SessionSummary, ProfessionalProfile } from '@job-agent/core';
import { generateMarkdownReport, generateHtmlReport } from './templates/report.template.js';
import winston from 'winston';
import chalk from 'chalk';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      const ts = String(timestamp);
      if (level === 'info') return `${chalk.gray(ts)} ${chalk.green('[REPORT]')} ${String(message)}`;
      return `${chalk.gray(ts)} [${level.toUpperCase()}] ${String(message)}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

export interface GenerateReportOptions {
  records: ApplicationRecord[];
  summary: SessionSummary;
  profile: ProfessionalProfile;
  format: 'markdown' | 'html' | 'both';
  outputDir: string;
}

export interface ReportPaths {
  markdown?: string;
  html?: string;
}

/**
 * Generates and writes the session report to disk.
 * @param options - Report generation options.
 * @returns Paths to the generated report files.
 */
export async function generateReport(options: GenerateReportOptions): Promise<ReportPaths> {
  const { records, summary, profile, format, outputDir } = options;

  await fs.mkdir(outputDir, { recursive: true });
  const paths: ReportPaths = {};

  if (format === 'markdown' || format === 'both') {
    const md = generateMarkdownReport(records, summary, profile);
    const mdPath = path.join(outputDir, 'report.md');
    await fs.writeFile(mdPath, md, 'utf-8');
    paths.markdown = mdPath;
    logger.info(`Markdown report saved: ${mdPath}`);
  }

  if (format === 'html' || format === 'both') {
    const html = generateHtmlReport(records, summary, profile);
    const htmlPath = path.join(outputDir, 'report.html');
    await fs.writeFile(htmlPath, html, 'utf-8');
    paths.html = htmlPath;
    logger.info(`HTML report saved: ${htmlPath}`);
  }

  return paths;
}
