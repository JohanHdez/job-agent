import Anthropic from '@anthropic-ai/sdk';
import type { ProfessionalProfile } from '@job-agent/core';
import { logger } from '../utils/logger';

/**
 * System prompt instructing Claude to return ONLY a JSON object conforming
 * to ProfessionalProfile — no markdown fences, no extra commentary.
 */
const SYSTEM_PROMPT = `You are a professional CV/resume parser. Your only job is to extract structured information from the raw CV text provided by the user and return it as a single valid JSON object.

RULES:
- Return ONLY a JSON object. No markdown, no code fences, no explanations.
- All fields must conform exactly to the TypeScript interface below.
- If a field cannot be determined, use a sensible default (empty string, empty array, 0, etc.).
- Infer seniority from years of experience: <2y=Junior, 2-4y=Mid, 4-7y=Senior, 7-10y=Lead, 10-15y=Principal, 15+y=Executive.

TypeScript interface:
{
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  headline: string;
  summary: string;
  seniority: "Junior" | "Mid" | "Senior" | "Lead" | "Principal" | "Executive";
  yearsOfExperience: number;
  skills: string[];        // ALL skills found (technical + soft)
  techStack: string[];     // Technical tools, languages, frameworks only
  languages: Array<{
    name: string;
    level: "Native" | "Fluent" | "Advanced" | "Intermediate" | "Basic";
  }>;
  experience: Array<{
    company: string;
    title: string;
    startDate: string;     // e.g. "2020-01" or "2020"
    endDate: string;       // ISO date or literal "Present"
    description: string[]; // bullet points from job description
    technologies: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    graduationYear: number;
  }>;
}`;

/**
 * Validates that the object returned by Claude matches the minimum shape
 * of ProfessionalProfile (non-exhaustive — just guards required string fields).
 */
function isValidProfile(obj: unknown): obj is ProfessionalProfile {
  if (typeof obj !== 'object' || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p['fullName'] === 'string' &&
    typeof p['email'] === 'string' &&
    typeof p['headline'] === 'string' &&
    typeof p['summary'] === 'string' &&
    typeof p['seniority'] === 'string' &&
    typeof p['yearsOfExperience'] === 'number' &&
    Array.isArray(p['skills']) &&
    Array.isArray(p['techStack']) &&
    Array.isArray(p['languages']) &&
    Array.isArray(p['experience']) &&
    Array.isArray(p['education'])
  );
}

/**
 * Sends raw CV text to Claude and returns a structured ProfessionalProfile.
 * Requires ANTHROPIC_API_KEY to be set in the environment.
 *
 * @param rawText - Plain text extracted from the CV file.
 * @returns Extracted ProfessionalProfile or null if the API call fails.
 */
export async function extractProfileWithClaude(
  rawText: string
): Promise<ProfessionalProfile | null> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    logger.warn('ANTHROPIC_API_KEY not set — skipping Claude extraction');
    return null;
  }

  const client = new Anthropic({ apiKey });

  logger.info('Sending CV text to Claude for structured extraction...');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extract the professional profile from this CV text:\n\n${rawText}`,
        },
      ],
    });

    const firstBlock = response.content[0];
    if (!firstBlock || firstBlock.type !== 'text') {
      logger.warn('Claude returned an unexpected response format');
      return null;
    }

    const jsonText = firstBlock.text.trim();
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // Claude sometimes wraps with markdown fences despite the instruction — strip them
      const stripped = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      try {
        parsed = JSON.parse(stripped);
      } catch {
        logger.warn('Could not parse Claude response as JSON — falling back to heuristics');
        return null;
      }
    }

    if (!isValidProfile(parsed)) {
      logger.warn('Claude response does not match ProfessionalProfile shape — falling back');
      return null;
    }

    logger.info(
      `Claude extraction successful: ${parsed.fullName} | ${parsed.seniority} | ${parsed.techStack.length} tech skills`
    );
    return parsed;
  } catch (err) {
    logger.warn(`Claude API call failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
