/**
 * Gemini 2.0 Flash email draft adapter for job application emails.
 *
 * Drop-in replacement for ClaudeEmailDraftAdapter — implements the same
 * EmailDraftAdapter interface using the Google Generative AI SDK.
 *
 * Free tier: 1500 req/day — sufficient for individual job applications.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EmailDraftAdapter, EmailDraftInput, EmailDraftOutput } from '@job-agent/core';
import { generateWithFallback } from './gemini-model-chain.js';

const MAX_RETRIES = 2;
const TIMEOUT_MS = 10000;

/**
 * Gemini-based email draft generator.
 * Produces professional, personalized application emails via the Gemini API.
 */
export class GeminiEmailDraftAdapter implements EmailDraftAdapter {
  readonly name = 'Gemini 2.0 Flash Email Draft Generator';

  private readonly genAI: GoogleGenerativeAI;

  /** @param apiKey - Google AI Studio API key */
  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generates a personalized application email draft.
   *
   * Calls Gemini API with job details and candidate profile.
   * Retries up to MAX_RETRIES times with exponential backoff.
   *
   * @param input - Job details and candidate profile
   * @returns Email subject and body ready for user review
   * @throws Error when all retry attempts fail
   */
  async generateDraft(input: EmailDraftInput): Promise<EmailDraftOutput> {
    const systemInstruction = [
      'You are a professional job application email writer.',
      'Write a concise application email in the SAME LANGUAGE as the job description.',
      'Requirements:',
      '- Maximum 150 words in the body',
      "- Mention exactly 2 specific points from the job description that the candidate's experience addresses",
      '- Be professional but warm - not robotic',
      '- Output ONLY valid JSON: { "subject": "...", "body": "..." }',
      '- The subject should be attractive and relevant to the role',
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
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini request timeout')), TIMEOUT_MS)
        );

        const text = await Promise.race([
          generateWithFallback(this.genAI, { systemInstruction }, userPrompt),
          timeoutPromise,
        ]);

        // Strip markdown fences if present
        const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(clean) as { subject?: string; body?: string };

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
