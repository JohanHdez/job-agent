import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ProfessionalProfile } from '@job-agent/core';
import { logger } from '../utils/logger';
import { generateWithFallback } from './gemini-model-chain';

/** Same system instructions as the Claude extractor — provider-agnostic prompt */
const SYSTEM_INSTRUCTION = `You are a professional CV/resume parser. Your only job is to extract structured information from the raw CV text provided by the user and return it as a single valid JSON object.

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
  skills: string[];
  techStack: string[];
  languages: Array<{
    name: string;
    level: "Native" | "Fluent" | "Advanced" | "Intermediate" | "Basic";
  }>;
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    description: string[];
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
 * Validates that the parsed object matches the minimum shape of ProfessionalProfile.
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
 * Sends raw CV text to Gemini 2.0 Flash and returns a structured ProfessionalProfile.
 * Requires GEMINI_API_KEY to be set in the environment.
 *
 * @param rawText - Plain text extracted from the CV file.
 * @returns Extracted ProfessionalProfile or null if the API call fails.
 */
export async function extractProfileWithGemini(
  rawText: string
): Promise<ProfessionalProfile | null> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    logger.warn('GEMINI_API_KEY not set — skipping Gemini extraction');
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  logger.info('Sending CV text to Gemini for structured extraction...');
  console.log('--- URL de llamada: v1beta/models/gemini-2.5-flash-lite:generateContent');

  try {
    const text = await generateWithFallback(
      genAI,
      { systemInstruction: SYSTEM_INSTRUCTION },
      `Extract the professional profile from this CV text:\n\n${rawText}`
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Strip markdown fences if present
      const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      try {
        parsed = JSON.parse(stripped);
      } catch {
        logger.warn('Could not parse Gemini response as JSON — falling back to heuristics');
        return null;
      }
    }

    if (!isValidProfile(parsed)) {
      logger.warn('Gemini response does not match ProfessionalProfile shape — falling back');
      return null;
    }

    logger.info(
      `Gemini extraction successful: ${parsed.fullName} | ${parsed.seniority} | ${parsed.techStack.length} tech skills`
    );
    return parsed;
  } catch (err) {
    logger.warn(`Gemini API call failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
