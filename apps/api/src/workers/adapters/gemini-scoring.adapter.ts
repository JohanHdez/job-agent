/**
 * Gemini 2.0 Flash job compatibility scoring adapter.
 *
 * Drop-in replacement for ClaudeScoringAdapter — implements the same
 * ScoringAdapter interface using the Google Generative AI SDK.
 *
 * Uses Gemini 2.0 Flash for fast, cost-free scoring.
 * Free tier: 1500 req/day, 1M tokens/day.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ScoringAdapter, ScoringInput, ScoredJob, ProfessionalProfile } from '@job-agent/core';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import chalk = require('chalk');
import { generateWithFallback } from './gemini-model-chain.js';

/**
 * Gemini-based job compatibility scorer.
 * Sends batches of up to 5 job descriptions to Gemini for scoring 0-100.
 */
export class GeminiScoringAdapter implements ScoringAdapter {
  readonly name = 'Gemini 2.0 Flash Scorer';

  private readonly genAI: GoogleGenerativeAI;

  /** @param apiKey - Google AI Studio API key */
  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Scores a batch of jobs against the user's professional profile.
   *
   * @param jobs - Array of up to 5 jobs to score in a single API call
   * @param profile - User's professional profile for comparison
   * @returns Array of ScoredJob with one entry per input, matched by index
   */
  async scoreBatch(jobs: ScoringInput[], profile: ProfessionalProfile): Promise<ScoredJob[]> {
    if (jobs.length === 0) return [];

    const sanitize = (s: string): string =>
      s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').trim();

    const profileSummary = [
      `Role: ${sanitize(profile.headline ?? '')}`,
      `Seniority: ${profile.seniority ?? 'Mid'} (${profile.yearsOfExperience ?? 0}y)`,
      `Skills: ${(profile.skills ?? []).slice(0, 10).map(sanitize).join(', ')}`,
      `Tech: ${(profile.techStack ?? []).slice(0, 8).map(sanitize).join(', ')}`,
      `Languages: ${(profile.languages ?? []).map((l) => sanitize(l.name ?? '')).join(', ')}`,
    ].join('\n');

    const jobDescriptions = jobs
      .map((j) => {
        const desc = sanitize(
          j.description.length > 400 ? j.description.substring(0, 400) + '...' : j.description
        );
        return `[${j.index}] ${sanitize(j.title)} at ${sanitize(j.company)} (${sanitize(j.location)})\n${desc}`;
      })
      .join('\n---\n');

    const prompt = `Score these jobs 0-100 for compatibility with this candidate. Consider: skills match, seniority fit, language match. Return ONLY valid JSON array.

CANDIDATE:
${profileSummary}

JOBS:
${jobDescriptions}

Return JSON: [{"index":0,"score":75,"reason":"max 15 words"}]`;

    try {
      const startMs = Date.now();

      const text = await generateWithFallback(this.genAI, {}, prompt);

      const elapsed = Date.now() - startMs;
      process.stdout.write(chalk.blue(`[scorer] Batch of ${jobs.length} scored in ${elapsed}ms (Gemini)\n`));

      // Parse JSON — handle markdown code blocks
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        process.stderr.write(
          chalk.red(`[scorer] Could not parse JSON from Gemini response: ${text.substring(0, 200)}\n`)
        );
        return jobs.map((j) => ({ index: j.index, score: 0, reason: 'scoring_parse_error' }));
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        index: number;
        score: number;
        reason: string;
      }>;

      return parsed.map((item) => ({
        index: item.index,
        score: Math.max(0, Math.min(100, Math.round(item.score))),
        reason: typeof item.reason === 'string' ? item.reason.substring(0, 100) : 'no_reason',
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(chalk.red(`[scorer] Gemini batch scoring failed: ${message}\n`));
      return jobs.map((j) => ({ index: j.index, score: 0, reason: 'scoring_api_error' }));
    }
  }
}
