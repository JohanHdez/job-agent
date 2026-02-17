/**
 * LinkedIn CSS selectors and XPaths.
 *
 * IMPORTANT: LinkedIn updates its frontend frequently.
 * All selectors are centralized here so updates require changes in ONE place only.
 * Each selector includes a comment describing what element it targets.
 *
 * Last verified: 2024-05
 */

export const SELECTORS = {
  // ─── Authentication ────────────────────────────────────────────────────────

  /** Email input on the login page */
  LOGIN_EMAIL: '#username',

  /** Password input on the login page */
  LOGIN_PASSWORD: '#password',

  /** Submit button on the login page */
  LOGIN_SUBMIT: 'button[type="submit"]',

  /** Element indicating a successful login (nav bar) */
  LOGIN_SUCCESS_INDICATOR: 'nav.global-nav',

  /** CAPTCHA challenge container */
  CAPTCHA_CONTAINER: '#captcha-internal',

  /** "Unusual activity" warning banner */
  UNUSUAL_ACTIVITY_BANNER: '.alert-content',

  // ─── Job Search ────────────────────────────────────────────────────────────

  /** Main search input for job keywords */
  SEARCH_KEYWORDS_INPUT: 'input[aria-label="Search by title, skill, or company"]',

  /** Location input in job search */
  SEARCH_LOCATION_INPUT: 'input[aria-label="City, state, or zip code"]',

  /** Search submit button */
  SEARCH_SUBMIT_BUTTON: 'button.jobs-search-box__submit-button',

  /** Individual job card in search results */
  JOB_CARD: '.job-search-card, .jobs-search-results__list-item',

  /** Job title link inside a card */
  JOB_CARD_TITLE: '.job-search-card__title, .job-card-list__title',

  /** Company name inside a card */
  JOB_CARD_COMPANY: '.job-search-card__company-name, .job-card-container__company-name',

  /** Location inside a card */
  JOB_CARD_LOCATION: '.job-search-card__location, .job-card-container__metadata-item',

  /** "Easy Apply" badge on a job card */
  JOB_CARD_EASY_APPLY_BADGE: '.job-search-card__easy-apply-label',

  /** Date posted metadata */
  JOB_CARD_DATE: '.job-search-card__listdate',

  /** "Load more" / pagination button */
  LOAD_MORE_BUTTON: 'button[aria-label="Load more results"]',

  // ─── Job Detail ────────────────────────────────────────────────────────────

  /** Full job description container */
  JOB_DETAIL_DESCRIPTION: '.jobs-description__content',

  /** Job title in detail view */
  JOB_DETAIL_TITLE: '.job-details-jobs-unified-top-card__job-title',

  /** Company name in detail view */
  JOB_DETAIL_COMPANY: '.job-details-jobs-unified-top-card__company-name',

  /** Location in detail view */
  JOB_DETAIL_LOCATION: '.job-details-jobs-unified-top-card__bullet',

  /** Work modality badge (Remote/Hybrid/On-site) */
  JOB_DETAIL_MODALITY: '.job-details-jobs-unified-top-card__workplace-type',

  /** "Easy Apply" button in detail view */
  EASY_APPLY_BUTTON: 'button.jobs-apply-button--top-card',

  /** "Apply" button (external) */
  EXTERNAL_APPLY_BUTTON: 'button.jobs-apply-button--top-card:not([aria-label*="Easy"])',

  // ─── Easy Apply Modal ──────────────────────────────────────────────────────

  /** Easy Apply modal/dialog container */
  EASY_APPLY_MODAL: '.jobs-easy-apply-content, [data-test-modal-id="easy-apply-modal"]',

  /** "Next" button in Easy Apply multi-step flow (EN + ES) */
  EASY_APPLY_NEXT_BUTTON: 'button[aria-label="Continue to next step"], button[aria-label="Continuar al siguiente paso"]',

  /** "Submit application" button — final step (EN + ES) */
  EASY_APPLY_SUBMIT_BUTTON: 'button[aria-label="Submit application"], button[aria-label="Enviar solicitud"]',

  /** "Review" button before final submission (EN + ES) */
  EASY_APPLY_REVIEW_BUTTON: 'button[aria-label="Review your application"], button[aria-label="Revisar tu solicitud"], button[aria-label="Revisar"]',

  /** Phone input in Easy Apply form */
  EASY_APPLY_PHONE_INPUT: 'input[id*="phoneNumber"]',

  /** Additional questions / text areas */
  EASY_APPLY_TEXT_INPUT: 'input[type="text"]:not([readonly])',

  /** Dropdown selects in Easy Apply */
  EASY_APPLY_SELECT: 'select',

  /** Success confirmation after submission (class or test-id) */
  EASY_APPLY_SUCCESS: '.jobs-easy-apply-content__success-message, [data-test-job-apply-success-modal], .artdeco-inline-feedback--success',

  /** Error/warning in Easy Apply flow */
  EASY_APPLY_ERROR: '.artdeco-inline-feedback--error',

  /** Close/dismiss button on Easy Apply modal (EN + ES) */
  EASY_APPLY_CLOSE_BUTTON: 'button[aria-label="Dismiss"], button[aria-label="Descartar"], button[aria-label="Cerrar"]',

  // ─── Filters ───────────────────────────────────────────────────────────────

  /** Remote filter checkbox */
  FILTER_REMOTE: 'label[for*="f_WT=2"]',

  /** Date posted filter button */
  FILTER_DATE_POSTED: 'button[aria-label*="Date posted filter"]',

  /** "Past 24 hours" date option */
  FILTER_DATE_24H: 'label[for*="f_TPR=r86400"]',

  /** "Past week" date option */
  FILTER_DATE_WEEK: 'label[for*="f_TPR=r604800"]',

  /** "Past month" date option */
  FILTER_DATE_MONTH: 'label[for*="f_TPR=r2592000"]',

  /** Apply filters button */
  FILTER_APPLY_BUTTON: 'button[data-control-name="filter_pill_apply"]',
} as const;

/** LinkedIn base URLs */
export const LINKEDIN_URLS = {
  BASE: 'https://www.linkedin.com',
  LOGIN: 'https://www.linkedin.com/login',
  JOBS_SEARCH: 'https://www.linkedin.com/jobs/search/',
  JOB_VIEW: (id: string) => `https://www.linkedin.com/jobs/view/${id}/`,
} as const;
