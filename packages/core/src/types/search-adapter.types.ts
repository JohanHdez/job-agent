/**
 * Adapter interface and supporting types for swappable job search providers.
 * All search providers (JSearch, Adzuna, etc.) must implement JobSearchAdapter.
 */

import type { PlatformId } from './config.types.js';

/**
 * Parameters passed to a job search adapter when initiating a search.
 * Derived from the active SearchConfigSnapshotType at session start.
 */
export interface SearchParams {
  /** Keywords to search for (passed as a combined query string to providers) */
  keywords: string[];
  /** Target location string */
  location: string;
  /** Allowed work modalities — adapters should filter or pass as query params */
  modality: ('Remote' | 'Hybrid' | 'On-site')[];
  /** Recency filter for job postings */
  datePosted: 'past_24h' | 'past_week' | 'past_month';
  /** Minimum number of results to collect before stopping pagination */
  minResults: number;
  /** Maximum number of pages to fetch — safety cap to prevent infinite loops */
  maxPages: number;
}

/**
 * Raw job result returned by a search adapter before scoring.
 * Adapters normalise provider-specific response shapes into this contract.
 */
export interface RawJobResult {
  /** Platform-specific unique job identifier (used for deduplication) */
  jobId: string;
  /** Job title as returned by the provider */
  title: string;
  /** Company name */
  company: string;
  /** Full job description text */
  description: string;
  /** Direct URL to the job posting */
  url: string;
  /** Location string as returned by the provider */
  location: string;
  /** Platform this result was fetched from */
  platform: PlatformId;
  /** ISO 8601 date string when the job was posted, as reported by the provider */
  postedAt: string;
}

/**
 * Interface for swappable job search providers.
 *
 * Implementations:
 * - JSearchAdapter  — RapidAPI JSearch (LinkedIn aggregator)
 * - AdzunaAdapter   — Adzuna direct API (future)
 * - MockAdapter     — deterministic stub for tests
 */
export interface JobSearchAdapter {
  /** Human-readable name of the provider (e.g. "JSearch (RapidAPI)") */
  readonly name: string;
  /** Platform ID this adapter searches */
  readonly platform: PlatformId;
  /**
   * Search for jobs matching the given parameters.
   * Handles pagination internally up to `params.maxPages`.
   * @param params - Search parameters derived from the active session config
   * @returns Array of raw job results before scoring — may be empty
   */
  search(params: SearchParams): Promise<RawJobResult[]>;
}
