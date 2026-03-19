/**
 * Mock session event generator for Phase 3 stub pipeline.
 *
 * This module generates realistic-looking session events using @faker-js/faker.
 * It is a Phase 3 stub — in Phase 4 these events will be replaced by the
 * real LinkedIn scraping and job scoring pipeline executed inside the
 * BullMQ worker process.
 *
 * @module mock-data.generator
 */

import { faker } from '@faker-js/faker';
import type {
  SessionEventUnion,
  SessionStartedEvent,
  JobFoundEvent,
  JobSkippedEvent,
  ApplicationMadeEvent,
  SessionCompleteEvent,
} from '@job-agent/core';

/** Platforms that can appear in JobFoundEvent */
const PLATFORMS = ['linkedin', 'indeed', 'computrabajo'] as const;

/** Reasons a job may be skipped */
const SKIP_REASONS: JobSkippedEvent['reason'][] = [
  'score_too_low',
  'already_applied',
  'excluded_company',
];

/**
 * Generates an ordered array of mock session events simulating a realistic
 * job-search automation run.
 *
 * Sequence:
 * 1. One `session_started` event
 * 2. 5–8 `job_found` events with realistic faker data
 * 3. 1–2 `job_skipped` events with realistic skip reasons
 * 4. 2–3 `application_made` events with easy_apply method
 * 5. One `session_complete` event with accurate aggregate totals
 *
 * @param sessionId - MongoDB ObjectId string of the running session
 * @param userId    - MongoDB ObjectId string of the owning user
 * @returns Ordered array of SessionEventUnion events ready to be published
 */
export function generateMockSessionEvents(
  sessionId: string,
  userId: string,
): SessionEventUnion[] {
  const events: SessionEventUnion[] = [];
  const startTime = Date.now();

  // --- 1. session_started ---
  const sessionStarted: SessionStartedEvent = {
    type: 'session_started',
    sessionId,
    userId,
    config: {},
    timestamp: new Date().toISOString(),
  };
  events.push(sessionStarted);

  // --- 2. job_found events (5–8) ---
  const jobFoundCount = faker.number.int({ min: 5, max: 8 });
  const foundJobIds: string[] = [];

  for (let i = 0; i < jobFoundCount; i++) {
    const jobId = faker.string.uuid();
    foundJobIds.push(jobId);

    const jobFound: JobFoundEvent = {
      type: 'job_found',
      jobId,
      title: faker.person.jobTitle(),
      company: faker.company.name(),
      location: faker.location.city(),
      platform: faker.helpers.arrayElement(PLATFORMS),
      compatibilityScore: faker.number.int({ min: 40, max: 98 }),
      url: faker.internet.url(),
      timestamp: new Date().toISOString(),
    };
    events.push(jobFound);
  }

  // --- 3. job_skipped events (1–2) ---
  const skipCount = faker.number.int({ min: 1, max: 2 });
  const skippedJobIds = faker.helpers.arrayElements(foundJobIds, skipCount);

  for (const jobId of skippedJobIds) {
    const jobSkipped: JobSkippedEvent = {
      type: 'job_skipped',
      jobId,
      reason: faker.helpers.arrayElement(SKIP_REASONS),
      timestamp: new Date().toISOString(),
    };
    events.push(jobSkipped);
  }

  // --- 4. application_made events (2–3) ---
  const applyCount = faker.number.int({ min: 2, max: 3 });
  // Apply to jobs that were not skipped
  const applyableJobIds = foundJobIds.filter((id) => !skippedJobIds.includes(id));
  const appliedJobIds = faker.helpers.arrayElements(
    applyableJobIds.length >= applyCount ? applyableJobIds : foundJobIds,
    Math.min(applyCount, applyableJobIds.length || foundJobIds.length),
  );

  for (const jobId of appliedJobIds) {
    const applicationMade: ApplicationMadeEvent = {
      type: 'application_made',
      jobId,
      method: 'easy_apply',
      status: 'success',
      timestamp: new Date().toISOString(),
    };
    events.push(applicationMade);
  }

  // --- 5. session_complete ---
  const durationMs = Date.now() - startTime;
  const sessionComplete: SessionCompleteEvent = {
    type: 'session_complete',
    sessionId,
    totals: {
      found: jobFoundCount,
      applied: appliedJobIds.length,
      skipped: skipCount,
      failed: 0,
    },
    durationMs,
    timestamp: new Date().toISOString(),
  };
  events.push(sessionComplete);

  return events;
}
