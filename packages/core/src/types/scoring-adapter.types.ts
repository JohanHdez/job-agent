/**
 * Adapter interface and supporting types for swappable job scoring providers.
 * All scoring implementations (Claude API, heuristic, disabled) must implement ScoringAdapter.
 */

import type { ProfessionalProfile } from './cv.types.js';

/**
 * Input representing a single job to be scored in a batch request.
 * Uses an `index` field to correlate responses back to the original input array.
 */
export interface ScoringInput {
  /** Zero-based position in the batch array — used to match response to input */
  index: number;
  /** Job title */
  title: string;
  /** Company name */
  company: string;
  /** Full job description text */
  description: string;
  /** Location string */
  location: string;
}

/**
 * Result of scoring a single job against a user's professional profile.
 */
export interface ScoredJob {
  /** Zero-based index matching the corresponding ScoringInput.index */
  index: number;
  /** Compatibility score from 0 (no match) to 100 (perfect match) */
  score: number;
  /** Brief, human-readable explanation of the score (max 15 words) */
  reason: string;
}

/**
 * Interface for swappable job scoring providers.
 *
 * Implementations:
 * - ClaudeScoringAdapter   — Claude claude-sonnet-4-6 via Anthropic API (batch up to 5 jobs per call)
 * - HeuristicScoringAdapter — keyword-based fallback when API is unavailable
 * - DisabledScoringAdapter  — returns score=50 for all jobs (scoring disabled)
 */
export interface ScoringAdapter {
  /** Human-readable name of the scorer (e.g. "Claude claude-sonnet-4-6 Scorer") */
  readonly name: string;
  /**
   * Score a batch of jobs against the user's professional profile.
   *
   * Callers should batch in groups of up to 5 to stay within token limits.
   * The returned array MUST contain one ScoredJob per input, in any order,
   * matched by `index`.
   *
   * @param jobs - Array of up to 5 jobs to score in a single call
   * @param profile - User's professional profile for comparison
   * @returns Array of scored results — each entry's `index` matches the input
   */
  scoreBatch(jobs: ScoringInput[], profile: ProfessionalProfile): Promise<ScoredJob[]>;
}
