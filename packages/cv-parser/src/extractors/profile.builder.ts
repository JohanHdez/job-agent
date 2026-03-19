import type {
  ProfessionalProfile,
  WorkExperience,
  Education,
  Language,
  RawCvData,
} from '@job-agent/core';
import { logger } from '../utils/logger';

/**
 * Heuristic patterns for extracting structured data from CV text.
 * All regex patterns are defined here to keep them maintainable.
 */
const PATTERNS = {
  email: /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/,
  phone: /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{6,10}/,
  linkedin: /linkedin\.com\/in\/[\w-]+/,
  yearsExp: /(\d+)\+?\s*(?:years?|años?)\s*(?:of\s*)?(?:experience|experiencia)/i,
  section: {
    experience: /(?:work\s+)?experience|experiencia\s+(?:laboral|profesional)/i,
    education: /education|educación|formación\s+académica/i,
    skills: /(?:technical\s+)?skills|habilidades|competencias/i,
    languages: /languages?|idiomas/i,
    summary: /summary|profile|about|resumen|perfil|sobre\s+mí/i,
  },
} as const;

/**
 * Seniority inference map based on total years of experience.
 */
function inferSeniority(
  years: number
): ProfessionalProfile['seniority'] {
  if (years < 2) return 'Junior';
  if (years < 4) return 'Mid';
  if (years < 7) return 'Senior';
  if (years < 10) return 'Lead';
  if (years < 15) return 'Principal';
  return 'Executive';
}

/**
 * Common technical skills to scan for in CV text.
 */
const KNOWN_TECH_SKILLS = [
  'TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'Ruby',
  'React', 'Angular', 'Vue', 'Next.js', 'Nuxt', 'Svelte',
  'Node.js', 'Express', 'NestJS', 'FastAPI', 'Django', 'Spring',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform',
  'Git', 'GitHub', 'GitLab', 'CI/CD', 'Jenkins', 'GitHub Actions',
  'REST', 'GraphQL', 'gRPC', 'WebSockets',
  'Linux', 'Bash', 'PowerShell',
];

/**
 * Escapes all special regex characters in a string.
 * Handles skills like "C++", "C#", "Node.js", etc.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, (ch) => `\\${ch}`);
}

/**
 * Scans raw CV text for known tech skills.
 * @param text - Raw CV text.
 * @returns Array of detected tech skills.
 */
function extractTechStack(text: string): string[] {
  return KNOWN_TECH_SKILLS.filter((skill) => {
    const escaped = escapeRegex(skill);
    // Use word boundary only if skill starts/ends with a word character
    const prefix = /^\w/.test(skill) ? '\\b' : '';
    const suffix = /\w$/.test(skill) ? '\\b' : '';
    return new RegExp(`${prefix}${escaped}${suffix}`, 'i').test(text);
  });
}

/**
 * Attempts to extract language proficiencies from CV text.
 * @param text - Raw CV text.
 * @returns Array of Language objects.
 */
function extractLanguages(text: string): Language[] {
  const languagePatterns: { name: string; pattern: RegExp }[] = [
    { name: 'English', pattern: /english/i },
    { name: 'Spanish', pattern: /spanish|español/i },
    { name: 'Portuguese', pattern: /portuguese|português/i },
    { name: 'French', pattern: /french|français/i },
    { name: 'German', pattern: /german|deutsch/i },
    { name: 'Italian', pattern: /italian|italiano/i },
  ];

  const levelMap: Record<string, Language['level']> = {
    native: 'Native',
    fluent: 'Fluent',
    advanced: 'Advanced',
    intermediate: 'Intermediate',
    basic: 'Basic',
    beginner: 'Basic',
    proficient: 'Fluent',
    'c2': 'Native',
    'c1': 'Fluent',
    'b2': 'Advanced',
    'b1': 'Intermediate',
    'a2': 'Basic',
    'a1': 'Basic',
  };

  const detected: Language[] = [];

  for (const { name, pattern } of languagePatterns) {
    if (pattern.test(text)) {
      // Look for a level indicator near the language mention
      const contextMatch = text.match(
        new RegExp(`${pattern.source}[\\s\\S]{0,30}(native|fluent|advanced|intermediate|basic|beginner|proficient|c[12]|b[12]|a[12])`, 'i')
      );
      const levelKey = contextMatch?.[1]?.toLowerCase() ?? 'intermediate';
      const level = levelMap[levelKey] ?? 'Intermediate';
      detected.push({ name, level });
    }
  }

  return detected.length > 0 ? detected : [{ name: 'English', level: 'Intermediate' }];
}

/**
 * Extracts work experience blocks from CV text.
 * Returns a simplified list — a real implementation would use AI/NLP.
 * @param text - Raw CV text.
 * @returns Array of WorkExperience entries.
 */
function extractExperience(text: string): WorkExperience[] {
  // Heuristic: look for lines that look like "Title at Company (date - date)"
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const entries: WorkExperience[] = [];

  const dateRangePattern = /(\d{4})\s*[-–]\s*(\d{4}|present|presente|current|actualidad)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (dateRangePattern.test(line) || (i > 0 && dateRangePattern.test(lines[i - 1] ?? ''))) {
      const dateMatch = line.match(dateRangePattern) ?? lines[i - 1]?.match(dateRangePattern);
      if (!dateMatch) continue;

      const title = (lines[i - 1] ?? lines[i] ?? 'Unknown Role').replace(dateRangePattern, '').trim();
      const endRaw = dateMatch[2] ?? 'Present';
      const endDate = /present|presente|current|actualidad/i.test(endRaw) ? 'Present' : endRaw;

      entries.push({
        title: title || 'Unknown Role',
        company: lines[i + 1] ?? 'Unknown Company',
        startDate: dateMatch[1] ?? 'Unknown',
        endDate,
        description: [],
        technologies: extractTechStack(lines.slice(i, i + 10).join(' ')),
      });
    }
  }

  return entries;
}

/**
 * Extracts education entries from CV text.
 * @param text - Raw CV text.
 * @returns Array of Education entries.
 */
function extractEducation(text: string): Education[] {
  const degrees: Education[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const degreeKeywords = /bachelor|master|phd|doctorate|licenciatura|grado|máster|ingeniería|engineering/i;
  const yearPattern = /\b(19|20)\d{2}\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (degreeKeywords.test(line)) {
      const yearMatch = line.match(yearPattern) ?? lines[i + 1]?.match(yearPattern);
      degrees.push({
        institution: lines[i + 1] ?? 'Unknown Institution',
        degree: line,
        field: '',
        graduationYear: yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear(),
      });
    }
  }

  return degrees;
}

/**
 * Builds a structured ProfessionalProfile from raw CV text.
 * Uses heuristic parsing — for production use, consider LLM-based extraction.
 * @param rawData - Raw text data extracted from the CV file.
 * @returns A fully typed ProfessionalProfile.
 */
export function buildProfile(rawData: RawCvData): ProfessionalProfile {
  const { text } = rawData;
  logger.info('Building professional profile from raw CV text...');

  const emailMatch = text.match(PATTERNS.email);
  const phoneMatch = text.match(PATTERNS.phone);
  const linkedinMatch = text.match(PATTERNS.linkedin);
  const yearsMatch = text.match(PATTERNS.yearsExp);

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullName = lines[0] ?? 'Unknown';
  const headline = lines[1] ?? 'Professional';

  const yearsOfExperience = yearsMatch ? parseInt(yearsMatch[1] ?? '0', 10) : 3;
  const techStack = extractTechStack(text);

  const profile: ProfessionalProfile = {
    fullName,
    email: emailMatch?.[0] ?? '',
    ...(phoneMatch?.[0] ? { phone: phoneMatch[0] } : {}),
    ...(linkedinMatch ? { linkedinUrl: `https://www.${linkedinMatch[0]}` } : {}),
    headline,
    summary: lines.slice(2, 5).join(' '),
    seniority: inferSeniority(yearsOfExperience),
    yearsOfExperience,
    skills: techStack,
    techStack,
    languages: extractLanguages(text),
    experience: extractExperience(text),
    education: extractEducation(text),
  };

  logger.info(
    `Profile built: ${profile.fullName} | ${profile.seniority} | ${profile.yearsOfExperience}y exp | ${profile.techStack.length} tech skills`
  );

  return profile;
}
