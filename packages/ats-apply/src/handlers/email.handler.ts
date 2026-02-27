/**
 * Email Application Handler
 *
 * Sends a job application via SMTP using nodemailer.
 * The email contains a personalised cover letter (plain text + HTML)
 * and the candidate's CV as an attachment.
 *
 * Required environment variables:
 *   SMTP_HOST  — e.g. smtp.gmail.com
 *   SMTP_PORT  — e.g. 587 (TLS) or 465 (SSL). Defaults to 587.
 *   SMTP_USER  — your full email address used for auth
 *   SMTP_PASS  — app-password or SMTP password
 *   SMTP_FROM  — optional display address; falls back to SMTP_USER
 */

import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';
import type { AppConfig, JobListing, ProfessionalProfile } from '@job-agent/core';
import { generateCoverLetter } from '../cover-letter.js';
import { logger } from '../utils/logger.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/**
 * Reads SMTP credentials from environment variables.
 * Throws a descriptive error if mandatory variables are missing.
 */
function getSmtpConfig(): SmtpConfig {
  const host = process.env['SMTP_HOST'];
  const user = process.env['SMTP_USER'];
  const pass = process.env['SMTP_PASS'];
  const port = parseInt(process.env['SMTP_PORT'] ?? '587', 10);
  const from = process.env['SMTP_FROM'] ?? user;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP not configured. Please set SMTP_HOST, SMTP_USER and SMTP_PASS in your .env file.',
    );
  }

  return { host, port, user, pass, from: from! };
}

/** Builds a professional subject line depending on the configured language. */
function buildSubject(profile: ProfessionalProfile, job: JobListing, lang: string): string {
  return lang === 'es'
    ? `Candidatura — ${job.title} | ${profile.fullName}`
    : `Application — ${job.title} | ${profile.fullName}`;
}

/** Wraps a plain-text cover letter in minimal HTML for rich-text email clients. */
function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>\n');
  return [
    '<!DOCTYPE html>',
    '<html><body style="font-family:sans-serif;line-height:1.7;color:#222;',
    'max-width:640px;margin:0 auto;padding:1.5rem">',
    escaped,
    '</body></html>',
  ].join('');
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmailApplyParams {
  /** Destination address extracted from the job description. */
  toEmail: string;
  profile: ProfessionalProfile;
  job:     JobListing;
  /** Absolute path to the candidate's CV (PDF or DOCX). */
  cvPath:  string;
  config:  AppConfig;
}

export interface EmailApplyResult {
  status: 'applied';
  /** SMTP message-id assigned by the mail server — proof of delivery. */
  confirmationId?: string;
}

// ── Main handler ──────────────────────────────────────────────────────────────

/**
 * Sends the job application by email.
 *
 * Always returns `'applied'` on success.
 * Throws an `Error` when SMTP credentials are missing or the send fails.
 */
export async function applyViaEmail(
  params: EmailApplyParams,
): Promise<EmailApplyResult> {
  const { toEmail, profile, job, cvPath, config } = params;

  const smtp   = getSmtpConfig();
  const lang   = config.coverLetter?.language ?? 'en';
  const letter = generateCoverLetter(profile, job, config);
  const subject = buildSubject(profile, job, lang);

  const ext        = (path.extname(cvPath).slice(1) || 'pdf').toLowerCase();
  const cvFileName = `CV_${profile.fullName.replace(/\s+/g, '_')}.${ext}`;
  const mimeType   = ext === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  logger.info(`[Email] Applying to "${job.title}" at ${job.company} → ${toEmail}`);

  const cvContent = await fs.readFile(cvPath);

  const transporter = nodemailer.createTransport({
    host:   smtp.host,
    port:   smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const info = await transporter.sendMail({
    from:    `"${profile.fullName}" <${smtp.from}>`,
    to:      toEmail,
    subject,
    text:    letter,
    html:    toHtml(letter),
    attachments: [
      {
        filename:    cvFileName,
        content:     cvContent,
        contentType: mimeType,
      },
    ],
  });

  const messageId: string | undefined = (info as { messageId?: string }).messageId;
  logger.info(
    `[Email] ✓ Application sent to ${toEmail} for "${job.title}"` +
    (messageId ? ` — message-id: ${messageId}` : ''),
  );
  return {
    status: 'applied',
    ...(messageId !== undefined ? { confirmationId: messageId } : {}),
  };
}
