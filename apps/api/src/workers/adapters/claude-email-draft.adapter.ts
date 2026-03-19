/**
 * Claude-based email draft adapter for job application emails.
 *
 * Generates personalized application emails by calling the Claude API
 * with the candidate's profile and job details. Enforces:
 * - 150-word body limit
 * - 2 specific match points from the job description
 * - Language matches the job description language
 * - 8s timeout with AbortController
 * - 2 retries with exponential backoff on API error
 *
 * Implements the EmailDraftAdapter interface for NestJS DI injection.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { EmailDraftAdapter, EmailDraftInput, EmailDraftOutput } from '@job-agent/core';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

/**
 * Claude-based email draft generator.
 * Produces professional, personalized application emails via the Anthropic API.
 */
export class ClaudeEmailDraftAdapter implements EmailDraftAdapter {
  readonly name = 'Claude Email Draft Generator';

  private readonly client: Anthropic;

  /** @param apiKey - Anthropic API key */
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Generates a personalized application email draft.
   *
   * Calls Claude API with job details and candidate profile.
   * Retries up to MAX_RETRIES times with exponential backoff.
   * Throws after 8s timeout if API does not respond.
   *
   * @param input - Job details and candidate profile
   * @returns Email subject and body ready for user review
   * @throws Error when all retry attempts fail or timeout is reached
   */
  async generateDraft(input: EmailDraftInput): Promise<EmailDraftOutput> {
    const systemPrompt = [
      'You are a professional job application email writer.',
      'Write a concise application email in the SAME LANGUAGE as the job description.',
      'Requirements:',
      '- Maximum 150 words in the body',
      '- Mention exactly 2 specific points from the job description that the candidate\'s experience addresses',
      '- Be professional but warm - not robotic',
      '- Output ONLY valid JSON: { "subject": "...", "body": "..." }',
      '- The subject should be attractive and relevant to the role - use your judgment on format',
      '- Do NOT include greetings like "Dear Hiring Manager" in the subject',
    ].join('\n');

    const userPrompt = [
      `## Job`,
      `Title: ${input.jobTitle}`,
      `Company: ${input.company}`,
      `Description:\n${input.jobDescription.slice(0, 2000)}`,
      '',
      `## Candidate Profile`,
      `Name: ${input.profile.fullName}`,
      `Headline: ${input.profile.headline}`,
      `Seniority: ${input.profile.seniority}`,
      `Years of experience: ${input.profile.yearsOfExperience}`,
      `Skills: ${input.profile.skills.join(', ')}`,
      `Tech stack: ${input.profile.techStack.join(', ')}`,
      `Summary: ${input.profile.summary.slice(0, 500)}`,
    ].join('\n');

    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await this.client.messages.create(
          {
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          },
          { signal: controller.signal }
        );

        clearTimeout(timer);

        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');

        const parsed = JSON.parse(text) as { subject?: string; body?: string };
        if (!parsed.subject || !parsed.body) {
          throw new Error('Invalid response: missing subject or body');
        }

        return { subject: parsed.subject, body: parsed.body };
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          await new Promise<void>((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError;
  }
}
