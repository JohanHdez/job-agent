/**
 * Template-based cover letter generator.
 *
 * Produces a short, personalised cover letter from the candidate's profile,
 * the target job, and the tone/language settings in AppConfig.
 * Can be replaced with an LLM-based generator in a future iteration.
 */

import type { AppConfig, JobListing, ProfessionalProfile } from '@job-agent/core';

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(tone: string, lang: string): string {
  if (lang === 'es') return 'Estimado equipo de selección,';
  switch (tone) {
    case 'casual':      return 'Hi there,';
    case 'enthusiastic': return 'Dear Hiring Team,';
    default:            return 'Dear Hiring Team,';
  }
}

function signOff(tone: string, lang: string, name: string): string {
  if (lang === 'es') {
    return `Quedo a su disposición para una entrevista.\n\nAtentamente,\n${name}`;
  }
  switch (tone) {
    case 'casual':
      return `I'd love to chat — feel free to reach out!\n\nCheers,\n${name}`;
    case 'enthusiastic':
      return `I am genuinely excited about this opportunity and would love to discuss it further!\n\nBest regards,\n${name}`;
    default:
      return `I look forward to the opportunity to discuss how I can contribute.\n\nBest regards,\n${name}`;
  }
}

function openingLine(tone: string, lang: string, title: string, company: string): string {
  if (lang === 'es') {
    return `Me complace presentar mi candidatura para el puesto de ${title} en ${company}.`;
  }
  switch (tone) {
    case 'enthusiastic':
      return `I am thrilled to apply for the ${title} role at ${company}!`;
    case 'casual':
      return `I came across the ${title} opening at ${company} and I think it's a great fit.`;
    default:
      return `I am writing to express my interest in the ${title} position at ${company}.`;
  }
}

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Generates a personalised cover letter from the candidate's profile and
 * the job listing using the language and tone from the app config.
 */
export function generateCoverLetter(
  profile: ProfessionalProfile,
  job: JobListing,
  config: AppConfig,
): string {
  const tone  = config.coverLetter?.tone     ?? 'professional';
  const lang  = config.coverLetter?.language ?? 'en';

  // Build a concise skill list: prefer techStack, fall back to skills
  const skillPool = [...(profile.techStack ?? []), ...(profile.skills ?? [])];
  // Remove duplicates (case-insensitive) and take top 5
  const seen = new Set<string>();
  const topSkills: string[] = [];
  for (const s of skillPool) {
    const key = s.toLowerCase();
    if (!seen.has(key)) { seen.add(key); topSkills.push(s); }
    if (topSkills.length >= 5) break;
  }

  const yearsStr = profile.yearsOfExperience
    ? (lang === 'es' ? `${profile.yearsOfExperience} años de experiencia` : `${profile.yearsOfExperience} years of experience`)
    : (lang === 'es' ? 'amplia experiencia' : 'extensive experience');

  if (lang === 'es') {
    return [
      greeting(tone, lang),
      '',
      openingLine(tone, lang, job.title, job.company),
      '',
      `Con ${yearsStr} como ${profile.headline}, aporto conocimientos sólidos en ${topSkills.join(', ')}.`,
      'A lo largo de mi carrera he trabajado en proyectos desafiantes que me han permitido desarrollar',
      'tanto mis habilidades técnicas como mi capacidad de trabajo en equipo y resolución de problemas.',
      '',
      `Estoy convencido de que mi perfil encaja bien con lo que busca ${job.company} y me encantaría`,
      'contribuir al éxito del equipo.',
      '',
      signOff(tone, lang, profile.fullName),
    ].join('\n');
  }

  return [
    greeting(tone, lang),
    '',
    openingLine(tone, lang, job.title, job.company),
    '',
    `With ${yearsStr} as ${profile.headline}, I bring hands-on expertise in ${topSkills.join(', ')}.`,
    'Throughout my career I have delivered impactful projects that sharpened my technical depth,',
    'collaborative mindset, and ability to solve complex problems under real-world constraints.',
    '',
    `I am confident that my background aligns closely with what ${job.company} is looking for`,
    'and I would welcome the chance to contribute to your team.',
    '',
    signOff(tone, lang, profile.fullName),
  ].join('\n');
}
