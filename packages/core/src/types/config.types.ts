/**
 * Types for application configuration (config.yaml).
 */

export type PlatformId =
  | 'linkedin'
  | 'indeed'
  | 'computrabajo'
  | 'bumeran'
  | 'getonboard'
  | 'infojobs'
  | 'greenhouse';

export interface AppConfig {
  search: {
    keywords: string[];
    location: string;
    modality: ('Remote' | 'Hybrid' | 'On-site')[];
    languages: string[];
    seniority: string[];
    datePosted: 'past_24h' | 'past_week' | 'past_month';
    excludedCompanies: string[];
    platforms: PlatformId[];
    /** Total jobs to collect across all platforms (default 100, max 300). */
    maxJobsToFind: number;
    /**
     * Greenhouse board tokens for companies to search when platform='greenhouse'.
     * Each token is the company slug used in boards.greenhouse.io/{token}/jobs.
     * Example: ['stripe', 'figma', 'notion']
     * Applied jobs appear at https://my.greenhouse.io under the candidate's account.
     */
    greenhouseCompanies?: string[];
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
  /**
   * Default answers for common questions in LinkedIn Easy Apply and
   * Greenhouse application forms (work auth, sponsorship, salary, etc.).
   * Filled automatically — no manual intervention required.
   */
  applicationDefaults?: {
    /** "Are you authorized/eligible to work in [country]?" → Yes/No */
    authorizedToWork?: boolean;
    /** "Will you require visa sponsorship?" → Yes/No */
    requiresSponsorship?: boolean;
    /** "Are you willing to relocate?" → Yes/No */
    willingToRelocate?: boolean;
    /** Expected salary — text shown in salary/compensation fields (e.g. "70000") */
    salaryExpectation?: string;
    /** Notice period / availability (e.g. "Immediately", "2 weeks") */
    availableFrom?: string;
    /** GitHub profile URL */
    githubUrl?: string;
    /** Portfolio or personal website URL */
    portfolioUrl?: string;
    /** Answer for "How did you hear about us?" dropdowns */
    howDidYouHear?: string;
    /** Generic years-of-experience answer (fallback for experience questions) */
    yearsOfExperience?: number;
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
