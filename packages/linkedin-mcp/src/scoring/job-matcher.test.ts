/**
 * Unit tests for the job scoring algorithm (scoreJob / rankJobs).
 *
 * Weights used by the algorithm:
 *   50% skills match   — tech stack overlap
 *   25% seniority match — level alignment
 *   15% keyword match  — skills present in title/description text
 *   10% location match — Remote=1.0, Hybrid=0.7, On-site=0.4
 */

import { describe, it, expect } from 'vitest';
import type { JobListing, ProfessionalProfile } from '@job-agent/core';
import { scoreJob, rankJobs } from './job-matcher.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A senior TypeScript developer profile used as baseline. */
const seniorProfile: ProfessionalProfile = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  headline: 'Senior TypeScript Developer',
  summary: 'Experienced engineer.',
  seniority: 'Senior',
  yearsOfExperience: 8,
  skills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL'],
  techStack: ['TypeScript', 'Node.js', 'React', 'PostgreSQL'],
  languages: [{ name: 'English', level: 'Native' }],
  experience: [],
  education: [],
};

/** A mid-level developer profile. */
const midProfile: ProfessionalProfile = {
  ...seniorProfile,
  seniority: 'Mid',
  headline: 'Mid TypeScript Developer',
  yearsOfExperience: 4,
};

/** A job that is a near-perfect match for seniorProfile. */
const perfectMatchJob: JobListing = {
  id: 'job-001',
  title: 'Senior TypeScript Developer',
  company: 'Acme Corp',
  location: 'Remote',
  modality: 'Remote',
  description: 'We use TypeScript, Node.js, React and PostgreSQL daily.',
  requiredSkills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL'],
  postedAt: '2026-03-01',
  applyUrl: 'https://example.com/jobs/001',
  hasEasyApply: true,
  compatibilityScore: 0,
  platform: 'linkedin',
};

/** A job with no required skills listed. */
const noSkillsJob: JobListing = {
  ...perfectMatchJob,
  id: 'job-002',
  title: 'Software Engineer',
  requiredSkills: [],
  description: '',
};

/** A job whose required skills do not overlap with the profile at all. */
const zeroMatchJob: JobListing = {
  ...perfectMatchJob,
  id: 'job-003',
  title: 'Junior COBOL Programmer',
  requiredSkills: ['COBOL', 'RPG', 'JCL'],
  description: 'Legacy COBOL maintenance.',
  modality: 'On-site',
};

/** A hybrid job with partial skill overlap. */
const partialMatchJob: JobListing = {
  ...perfectMatchJob,
  id: 'job-004',
  title: 'Full Stack Developer',
  modality: 'Hybrid',
  requiredSkills: ['TypeScript', 'Python', 'Django', 'PostgreSQL'],
  description: 'TypeScript frontend, Python backend.',
};

// ─── scoreJob tests ───────────────────────────────────────────────────────────

describe('scoreJob', () => {
  it('returns a score between 0 and 100 for any input', () => {
    const result = scoreJob(perfectMatchJob, seniorProfile);
    expect(result.compatibilityScore).toBeGreaterThanOrEqual(0);
    expect(result.compatibilityScore).toBeLessThanOrEqual(100);
  });

  it('does not mutate the original job object', () => {
    const original = { ...perfectMatchJob, compatibilityScore: 0 };
    scoreJob(original, seniorProfile);
    expect(original.compatibilityScore).toBe(0);
  });

  it('returns the full job listing with the new score attached', () => {
    const result = scoreJob(perfectMatchJob, seniorProfile);
    expect(result.id).toBe(perfectMatchJob.id);
    expect(result.title).toBe(perfectMatchJob.title);
    expect(result.company).toBe(perfectMatchJob.company);
  });

  it('gives a high score (>= 80) for a near-perfect match', () => {
    const result = scoreJob(perfectMatchJob, seniorProfile);
    expect(result.compatibilityScore).toBeGreaterThanOrEqual(80);
  });

  it('gives a low score (< 50) for a zero-skill-overlap + seniority mismatch + on-site job', () => {
    const result = scoreJob(zeroMatchJob, seniorProfile);
    // skills = 0, seniority mismatch (Senior vs Junior = 2 levels = 0.4), keywords = 0, location = 0.4
    // raw = 0*0.5 + 0.4*0.25 + 0*0.15 + 0.4*0.10 = 0.10 + 0.04 = 0.14 → 14
    expect(result.compatibilityScore).toBeLessThan(50);
  });

  it('grants benefit-of-the-doubt score when job has no required skills', () => {
    const result = scoreJob(noSkillsJob, seniorProfile);
    // skills fallback = 0.7, seniority neutral (no seniority in title) = 1.0
    // keywords = 0 (description is empty), location = Remote = 1.0
    // raw = 0.7*0.5 + 1.0*0.25 + 0*0.15 + 1.0*0.10 = 0.35 + 0.25 + 0.10 = 0.70 → 70
    expect(result.compatibilityScore).toBeGreaterThanOrEqual(65);
  });

  it('penalises seniority mismatch: Junior job for Senior candidate', () => {
    const juniorJob: JobListing = {
      ...perfectMatchJob,
      id: 'job-005',
      title: 'Junior TypeScript Developer',
      modality: 'Remote',
    };
    const result = scoreJob(juniorJob, seniorProfile);
    // Seniority: Senior(3) vs Junior(1) = diff 2 → score = max(0, 1 - 2*0.3) = 0.4
    // That reduces the overall score compared to a perfect match
    const perfect = scoreJob(perfectMatchJob, seniorProfile);
    expect(result.compatibilityScore).toBeLessThan(perfect.compatibilityScore);
  });

  it('gives a lower score for On-site vs Remote for the same job', () => {
    const remoteJob = { ...perfectMatchJob, modality: 'Remote' as const };
    const onsiteJob = { ...perfectMatchJob, id: 'job-006', modality: 'On-site' as const };
    const remoteScore = scoreJob(remoteJob, seniorProfile).compatibilityScore;
    const onsiteScore = scoreJob(onsiteJob, seniorProfile).compatibilityScore;
    expect(remoteScore).toBeGreaterThan(onsiteScore);
  });

  it('gives Hybrid a score between On-site and Remote', () => {
    const remoteJob  = { ...perfectMatchJob, modality: 'Remote'  as const };
    const hybridJob  = { ...perfectMatchJob, id: 'job-007', modality: 'Hybrid'  as const };
    const onsiteJob  = { ...perfectMatchJob, id: 'job-008', modality: 'On-site' as const };
    const r = scoreJob(remoteJob,  seniorProfile).compatibilityScore;
    const h = scoreJob(hybridJob,  seniorProfile).compatibilityScore;
    const o = scoreJob(onsiteJob,  seniorProfile).compatibilityScore;
    expect(r).toBeGreaterThanOrEqual(h);
    expect(h).toBeGreaterThanOrEqual(o);
  });

  it('awards partial skill overlap proportionally', () => {
    // partialMatchJob has 2/4 skills matching: TypeScript + PostgreSQL
    const result = scoreJob(partialMatchJob, seniorProfile);
    // skills = 0.5, seniority neutral (1.0), keywords includes TypeScript in desc, location=Hybrid=0.7
    expect(result.compatibilityScore).toBeGreaterThan(0);
    expect(result.compatibilityScore).toBeLessThan(100);
  });

  it('skill matching is case-insensitive', () => {
    const caseJob: JobListing = {
      ...perfectMatchJob,
      id: 'job-009',
      requiredSkills: ['TYPESCRIPT', 'NODE.JS', 'REACT', 'POSTGRESQL'],
    };
    const result = scoreJob(caseJob, seniorProfile);
    // Should match all 4 skills despite case difference
    const perfectResult = scoreJob(perfectMatchJob, seniorProfile);
    expect(result.compatibilityScore).toBe(perfectResult.compatibilityScore);
  });

  it('keyword match scores keywords found in description text', () => {
    const descriptionRichJob: JobListing = {
      ...noSkillsJob,
      id: 'job-010',
      description: 'Looking for TypeScript, Node.js, React and PostgreSQL expertise.',
    };
    const withDesc  = scoreJob(descriptionRichJob, seniorProfile).compatibilityScore;
    const noDesc    = scoreJob(noSkillsJob,         seniorProfile).compatibilityScore;
    expect(withDesc).toBeGreaterThan(noDesc);
  });
});

// ─── rankJobs tests ───────────────────────────────────────────────────────────

describe('rankJobs', () => {
  const jobs = [zeroMatchJob, partialMatchJob, perfectMatchJob, noSkillsJob];

  it('returns jobs sorted by score descending', () => {
    const ranked = rankJobs(jobs, seniorProfile, 0);
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i]!.compatibilityScore).toBeGreaterThanOrEqual(ranked[i + 1]!.compatibilityScore);
    }
  });

  it('filters out jobs below minScore', () => {
    const ranked = rankJobs(jobs, seniorProfile, 50);
    for (const job of ranked) {
      expect(job.compatibilityScore).toBeGreaterThanOrEqual(50);
    }
  });

  it('returns all jobs when minScore is 0', () => {
    const ranked = rankJobs(jobs, seniorProfile, 0);
    expect(ranked).toHaveLength(jobs.length);
  });

  it('returns an empty array when minScore is 100 and no job is a perfect match', () => {
    const ranked = rankJobs([zeroMatchJob], seniorProfile, 100);
    expect(ranked).toHaveLength(0);
  });

  it('returns an empty array when the input list is empty', () => {
    const ranked = rankJobs([], seniorProfile, 0);
    expect(ranked).toHaveLength(0);
  });

  it('scores are populated on returned items (not zero)', () => {
    const ranked = rankJobs([perfectMatchJob], seniorProfile, 0);
    expect(ranked[0]!.compatibilityScore).toBeGreaterThan(0);
  });

  it('uses the correct minScore default (0) — returns all jobs', () => {
    const ranked = rankJobs(jobs, seniorProfile);
    expect(ranked).toHaveLength(jobs.length);
  });

  it('does not modify the original job objects in the input array', () => {
    const input = jobs.map((j) => ({ ...j, compatibilityScore: 0 }));
    rankJobs(input, seniorProfile, 0);
    for (const job of input) {
      expect(job.compatibilityScore).toBe(0);
    }
  });

  it('mid-profile scores lower than senior-profile on a Senior-titled job', () => {
    const seniorRanked = rankJobs([perfectMatchJob], seniorProfile, 0);
    const midRanked    = rankJobs([perfectMatchJob], midProfile,    0);
    expect(seniorRanked[0]!.compatibilityScore).toBeGreaterThan(midRanked[0]!.compatibilityScore);
  });
});
