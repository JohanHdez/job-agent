/**
 * Types for application configuration (config.yaml).
 */

export interface AppConfig {
  search: {
    keywords: string[];
    location: string;
    modality: ('Remote' | 'Hybrid' | 'On-site')[];
    languages: string[];
    seniority: string[];
    datePosted: 'past_24h' | 'past_week' | 'past_month';
    excludedCompanies: string[];
  };
  matching: {
    minScoreToApply: number;
    maxApplicationsPerSession: number;
  };
  coverLetter: {
    language: 'en' | 'es';
    tone: 'professional' | 'casual' | 'enthusiastic';
  };
  report: {
    format: 'markdown' | 'html' | 'both';
  };
}

/** LinkedIn session/credentials loaded from .env */
export interface LinkedInCredentials {
  email: string;
  password: string;
}

/** Runtime environment configuration */
export interface RuntimeConfig {
  headless: boolean;
  slowMo: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  cvDir: string;
  outputDir: string;
  configPath: string;
  apiPort: number;
}
