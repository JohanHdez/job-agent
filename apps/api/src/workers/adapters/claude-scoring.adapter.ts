/**
 * Claude-based job compatibility scoring adapter.
 *
 * Sends batches of up to 5 job descriptions to claude-sonnet-4-6 for scoring
 * 0-100 against the user's professional profile.
 *
 * Key behaviours:
 * - Batches jobs (callers are responsible for grouping by 5, per ScoringAdapter contract)
 * - Truncates descriptions to 500 chars to minimise token usage
 * - Parses JSON from response, handles markdown code block wrappers
 * - Clamps scores to 0-100 range
 * - Returns score=0 with reason 'scoring_api_error' on any failure (graceful degradation)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ScoringAdapter, ScoringInput, ScoredJob, ProfessionalProfile } from '@job-agent/core';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import chalk = require('chalk');

/**
 * Claude-based job compatibility scorer.
 * Sends batches of up to 5 job descriptions to claude-sonnet-4-6 for scoring 0-100.
 */
export class ClaudeScoringAdapter implements ScoringAdapter {
  readonly name = 'Claude claude-sonnet-4-6 Scorer';

  private readonly client: Anthropic;

  /** @param apiKey - Anthropic API key */
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Scores a batch of jobs against the user's professional profile.
   *
   * Each job is scored 0-100 for compatibility. Considers:
   * - Skills and tech stack match
   * - Seniority fit
   * - Language requirements
   *
   * @param jobs - Array of up to 5 jobs to score in a single API call
   * @param profile - User's professional profile for comparison
   * @returns Array of ScoredJob with one entry per input, matched by index
   */
  async scoreBatch(jobs: ScoringInput[], profile: ProfessionalProfile): Promise<ScoredJob[]> {
    if (jobs.length === 0) return [];

    const profileSummary = [
      `Role: ${profile.headline}`,
      `Seniority: ${profile.seniority} (${profile.yearsOfExperience}y)`,
      `Skills: ${profile.skills.slice(0, 15).join(', ')}`,
      `Tech: ${profile.techStack.slice(0, 10).join(', ')}`,
      `Languages: ${profile.languages.map((l) => l.name).join(', ')}`,
    ].join('\n');

    const jobDescriptions = jobs
      .map((j) => {
        // Truncate description to 500 chars to minimise tokens
        const desc =
          j.description.length > 500
            ? j.description.substring(0, 500) + '...'
            : j.description;
        return `[${j.index}] ${j.title} at ${j.company} (${j.location})\n${desc}`;
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

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const elapsed = Date.now() - startMs;
      process.stdout.write(chalk.blue(`[scorer] Batch of ${jobs.length} scored in ${elapsed}ms\n`));

      // Extract text content from response
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Parse JSON from response — handle markdown code blocks
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        process.stderr.write(
          chalk.red(`[scorer] Could not parse JSON from response: ${text.substring(0, 200)}\n`),
        );
        return jobs.map((j) => ({ index: j.index, score: 0, reason: 'scoring_parse_error' }));
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        index: number;
        score: number;
        reason: string;
      }>;

      // Validate and clamp scores to 0-100
      return parsed.map((item) => ({
        index: item.index,
        score: Math.max(0, Math.min(100, Math.round(item.score))),
        reason: typeof item.reason === 'string' ? item.reason.substring(0, 100) : 'no_reason',
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(chalk.red(`[scorer] Batch scoring failed: ${message}\n`));
      // Graceful degradation: return 0 scores on error so pipeline continues
      return jobs.map((j) => ({ index: j.index, score: 0, reason: 'scoring_api_error' }));
    }
  }
}
