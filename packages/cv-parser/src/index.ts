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
import { parseCV } from './parsers/pdf.parser.js';
import { buildProfile } from './extractors/profile.builder.js';
import { logger } from './utils/logger.js';

export { parseCV } from './parsers/pdf.parser.js';
export { buildProfile } from './extractors/profile.builder.js';

/**
 * Full pipeline: parse a CV file and return the professional profile.
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
  const profile = buildProfile(rawData);

  if (outputPath) {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(profile, null, 2), 'utf-8');
    logger.info(`Profile saved to: ${outputPath}`);
  }

  return profile;
}
