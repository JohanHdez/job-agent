import type { PlatformId } from './config.types.js';

/**
 * SMTP configuration for sending application emails on behalf of the user.
 * The password field is stored AES-256-GCM encrypted at rest.
 */
export interface SmtpConfigType {
  /** SMTP server hostname (e.g. "smtp.gmail.com") */
  host: string;
  /** SMTP port (e.g. 587 for STARTTLS, 465 for SSL) */
  port: number;
  /** Whether to use TLS/SSL for the connection */
  secure: boolean;
  /** SMTP login username (usually the sender email) */
  user: string;
  /** SMTP login password — stored AES-256-GCM encrypted at rest */
  password: string;
  /** Display name shown in the "From" header (e.g. "John Doe") */
  fromName: string;
  /** Email address shown in the "From" header */
  fromEmail: string;
}

/** A named search configuration preset saved per-user. */
export interface SearchPresetType {
  id: string;
  name: string;
  keywords: string[];
  location: string;
  modality: ('Remote' | 'Hybrid' | 'On-site')[];
  platforms: PlatformId[];
  seniority: string[];
  languages: string[];
  datePosted: 'past_24h' | 'past_week' | 'past_month';
  minScoreToApply: number;
  maxApplicationsPerSession: number;
  excludedCompanies: string[];
}
