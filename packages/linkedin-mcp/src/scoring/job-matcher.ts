import type { JobListing, ProfessionalProfile } from '@job-agent/core';
import { logger } from '../utils/logger.js';

/**
 * Weights for the scoring algorithm (must sum to 1.0).
 */
const WEIGHTS = {
  skillsMatch: 0.50,    // Tech stack overlap
  seniorityMatch: 0.25, // Seniority level alignment
  keywordMatch: 0.15,   // Keywords in title/description
  locationMatch: 0.10,  // Modality preference
} as const;

/** Seniority rank for comparison */
const SENIORITY_RANK: Record<ProfessionalProfile['seniority'], number> = {
  Junior: 1,
  Mid: 2,
  Senior: 3,
  Lead: 4,
  Principal: 5,
  Executive: 6,
};

/**
 * Computes a 0–100 compatibility score between a job listing and a candidate profile.
 *
 * Scoring breakdown:
 * - 50%: skill/tech stack overlap
 * - 25%: seniority level alignment
 * - 15%: keyword presence in title and description
 * - 10%: remote/hybrid modality preference
 *
 * @param job - The job listing to score.
 * @param profile - The candidate's professional profile.
 * @returns The same job listing with compatibilityScore populated (0-100).
 */
export function scoreJob(job: JobListing, profile: ProfessionalProfile): JobListing {
  // ── 1. Skills match (50%) ────────────────────────────────────────────────
  const profileSkills = new Set(profile.techStack.map((s) => s.toLowerCase()));
  const jobSkills = job.requiredSkills.map((s) => s.toLowerCase());
  const matchedSkills = jobSkills.filter((s) => profileSkills.has(s));
  const skillScore =
    jobSkills.length > 0 ? matchedSkills.length / jobSkills.length : 0.5;

  // ── 2. Seniority match (25%) ─────────────────────────────────────────────
  const profileRank = SENIORITY_RANK[profile.seniority];
  const titleLower = job.title.toLowerCase();
  let inferredRank = profileRank; // fallback: neutral

  if (/junior|entry.?level|associate/i.test(titleLower)) inferredRank = 1;
  else if (/mid.?level|intermediate/i.test(titleLower)) inferredRank = 2;
  else if (/senior|sr\.?/i.test(titleLower)) inferredRank = 3;
  else if (/lead|staff/i.test(titleLower)) inferredRank = 4;
  else if (/principal|architect/i.test(titleLower)) inferredRank = 5;
  else if (/director|vp|head\s+of|cto/i.test(titleLower)) inferredRank = 6;

  const rankDiff = Math.abs(profileRank - inferredRank);
  const seniorityScore = Math.max(0, 1 - rankDiff * 0.3); // -30% per level off

  // ── 3. Keyword match (15%) ───────────────────────────────────────────────
  const searchableText = `${job.title} ${job.description}`.toLowerCase();
  const keywordMatches = profile.techStack.filter((skill) =>
    searchableText.includes(skill.toLowerCase())
  );
  const keywordScore = Math.min(1, keywordMatches.length / Math.max(profile.techStack.length, 1));

  // ── 4. Location/modality preference (10%) ────────────────────────────────
  // We don't have preference here — assume Remote/Hybrid is preferred
  const locationScore =
    job.modality === 'Remote' ? 1.0 : job.modality === 'Hybrid' ? 0.7 : 0.4;

  // ── Final weighted score ─────────────────────────────────────────────────
  const raw =
    skillScore * WEIGHTS.skillsMatch +
    seniorityScore * WEIGHTS.seniorityMatch +
    keywordScore * WEIGHTS.keywordMatch +
    locationScore * WEIGHTS.locationMatch;

  const score = Math.round(raw * 100);

  logger.debug(
    `Score for "${job.title}" @ ${job.company}: ${score} ` +
    `(skills=${Math.round(skillScore * 100)}, seniority=${Math.round(seniorityScore * 100)}, ` +
    `keywords=${Math.round(keywordScore * 100)}, location=${Math.round(locationScore * 100)})`
  );

  return { ...job, compatibilityScore: score };
}

/**
 * Scores and sorts a list of jobs by compatibility with the profile.
 * @param jobs - Array of job listings to score.
 * @param profile - Candidate's profile.
 * @param minScore - Minimum score threshold (0-100).
 * @returns Jobs above minScore, sorted by score descending.
 */
export function rankJobs(
  jobs: JobListing[],
  profile: ProfessionalProfile,
  minScore = 0
): JobListing[] {
  const scored = jobs.map((job) => scoreJob(job, profile));
  const filtered = scored.filter((j) => j.compatibilityScore >= minScore);
  return filtered.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
}
