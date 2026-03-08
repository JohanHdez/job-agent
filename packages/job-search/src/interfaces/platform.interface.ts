import type { AppConfig, JobListing, PlatformId } from '@job-agent/core';

/**
 * Unified interface that every platform-specific job searcher must implement.
 * All searchers use plain HTTP requests — no browser required.
 */
export interface IPlatformSearcher {
  /** Unique identifier for this platform (matches PlatformId union). */
  readonly platformId: PlatformId;

  /**
   * Executes a job search on the target platform via HTTP (API, RSS, or HTML fetch).
   *
   * @param config - Application config with search filters.
   * @param maxResults - Maximum number of listings to collect.
   * @returns Array of JobListing objects with `platform` populated.
   */
  search(config: AppConfig, maxResults: number): Promise<JobListing[]>;
}
