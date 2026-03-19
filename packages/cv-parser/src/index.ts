/**
 * @job-agent/cv-parser
 *
 * Parses PDF or DOCX CV files and builds a structured ProfessionalProfile.
 *
 * Usage:
 *   import { runCvParser } from '@job-agent/cv-parser';
 *   const profile = await runCvParser('./cv/my-resume.pdf');
 */

import fs from 'fs/promises';
import path from 'path';
import type { ProfessionalProfile } from '@job-agent/core';
import { parseCV } from './parsers/pdf.parser';
import { buildProfile } from './extractors/profile.builder';
import { extractProfileWithClaude } from './extractors/claude.extractor';
import { extractProfileWithGemini } from './extractors/gemini.extractor';
import { logger } from './utils/logger';

export { parseCV } from './parsers/pdf.parser';
export { buildProfile } from './extractors/profile.builder';
export { extractProfileWithClaude } from './extractors/claude.extractor';
export { extractProfileWithGemini } from './extractors/gemini.extractor';

/**
 * Selects the AI extractor based on the AI_PROVIDER env variable.
 * Returns the extracted profile or null on failure.
 */
async function extractWithAiProvider(rawText: string): Promise<ReturnType<typeof buildProfile> | null> {
  const provider = (process.env['AI_PROVIDER'] ?? 'gemini').toLowerCase().trim();
  if (provider === 'claude') {
    return extractProfileWithClaude(rawText);
  }
  console.log('--- USANDO GEMINI PARA EXTRACCIÓN ---')
  return extractProfileWithGemini(rawText);
}

/**
 * Full pipeline: parse a CV file and return the professional profile.
 *
 * Extraction strategy (in order):
 *   1. Claude API (requires ANTHROPIC_API_KEY) — most accurate
 *   2. Heuristic regex parser — fallback when API key is absent or call fails
 *
 * @param cvPath - Path to the PDF or DOCX file.
 * @param outputPath - Optional path to save the profile as JSON.
 * @returns The extracted ProfessionalProfile.
 */
export async function runCvParser(
  cvPath: string,
  outputPath?: string
): Promise<ProfessionalProfile> {
  logger.info(`Starting CV parser for: ${cvPath}`);

  const rawData = await parseCV(cvPath);

  // 1. Try AI extraction (provider selected via AI_PROVIDER env var)
  const aiProfile = await extractWithAiProvider(rawData.text);

  // 2. Fall back to heuristic extraction if AI provider is unavailable or fails
  const profile: ProfessionalProfile = aiProfile ?? buildProfile(rawData);

  if (!aiProfile) {
    logger.info('Using heuristic extraction (AI provider unavailable or failed)');
  }

  if (outputPath) {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(profile, null, 2), 'utf-8');
    logger.info(`Profile saved to: ${outputPath}`);
  }

  return profile;
}
