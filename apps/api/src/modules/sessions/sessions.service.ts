import { Injectable, ConflictException, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { Observable, take } from 'rxjs';
import { createLogger } from '@job-agent/logger';
import type { StoredSessionEvent, SearchConfigSnapshotType } from '@job-agent/core';
import { Session, SessionDocument } from './schemas/session.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { REDIS_SUBSCRIBER } from '../../common/redis/redis-subscriber.provider.js';

const logger = createLogger('SessionsService');

/**
 * Service managing the full lifecycle of job-search automation sessions.
 *
 * Responsibilities:
 * - Create sessions and enqueue BullMQ jobs
 * - Enforce one-active-session-per-user invariant (409 Conflict)
 * - Resolve user's active preset into SearchConfigSnapshotType at session creation time
 * - Atomically append ring-buffer events to the session document
 * - Subscribe to Redis Pub/Sub channels to deliver live events to the SSE controller
 */
@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectQueue('search-session') private readonly searchSessionQueue: Queue,
    @Inject(REDIS_SUBSCRIBER) private readonly redisSubscriber: Redis,
  ) {}

  /**
   * Creates a new search session for the given user.
   *
   * Resolves the user's active search preset and embeds the SearchConfigSnapshotType
   * in the session document. Checks for an existing active session (queued or running)
   * and throws a 409 ConflictException if one exists. Otherwise creates a Session
   * document with status='queued' and enqueues a BullMQ job.
   *
   * @param userId - MongoDB ObjectId string of the session owner
   * @returns Object containing the new sessionId
   * @throws ConflictException (409) when user already has an active session
   * @throws BadRequestException (400) when user has no active preset
   * @throws BadRequestException (400) when active preset id does not match any preset
   */
  async createSession(userId: string): Promise<{ sessionId: string }> {
    const activeSession = await this.sessionModel
      .findOne({ userId, status: { $in: ['queued', 'running'] } })
      .exec();

    if (activeSession) {
      const existingId = (activeSession._id as { toHexString(): string }).toHexString();
      logger.warn('Conflict: user already has an active session', { userId, sessionId: existingId });
      throw new ConflictException({ code: 'SESSION_ALREADY_ACTIVE', sessionId: existingId });
    }

    // Resolve active preset from user document
    const user = await this.userModel
      .findById(userId, { searchPresets: 1, activePresetId: 1, searchConfig: 1 })
      .lean()
      .exec();

    // Build SearchConfigSnapshot — prefer active preset, fall back to searchConfig
    let config: SearchConfigSnapshotType;

    if (user?.activePresetId) {
      const preset = user.searchPresets.find((p) => p.id === user.activePresetId);
      if (!preset) {
        throw new BadRequestException({
          code: 'PRESET_NOT_FOUND',
          message: `Active preset ${user.activePresetId} not found in user presets`,
        });
      }
      config = {
        keywords: preset.keywords,
        location: preset.location,
        modality: preset.modality,
        platforms: preset.platforms,
        seniority: preset.seniority,
        languages: preset.languages,
        datePosted: preset.datePosted,
        minScoreToApply: preset.minScoreToApply,
        maxApplicationsPerSession: preset.maxApplicationsPerSession,
        excludedCompanies: preset.excludedCompanies,
      };
    } else {
      // Fall back to searchConfig saved from ConfigPage
      const sc = user?.searchConfig;
      if (!sc) {
        throw new BadRequestException({
          code: 'NO_SEARCH_CONFIG',
          message: 'Configure your search settings before starting a session',
        });
      }
      config = {
        keywords: sc.search.keywords,
        location: sc.search.location,
        modality: sc.search.modality,
        platforms: sc.search.platforms,
        seniority: sc.search.seniority,
        languages: sc.search.languages,
        datePosted: sc.search.datePosted,
        minScoreToApply: sc.matching.minScoreToApply,
        maxApplicationsPerSession: sc.matching.maxApplicationsPerSession,
        excludedCompanies: sc.search.excludedCompanies,
      };
    }

    const session = await this.sessionModel.create({
      userId,
      status: 'queued',
      config,
      events: [],
      nextEventId: 0,
    });

    const sessionId = (session._id as { toHexString(): string }).toHexString();

    await this.searchSessionQueue.add(
      'run-session',
      { sessionId, userId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      }
    );

    logger.info('Session created and job enqueued', { userId, sessionId });
    return { sessionId };
  }

  /**
   * Retrieves a session by id, verifying ownership against the provided userId.
   *
   * @param sessionId - MongoDB ObjectId string of the session
   * @param userId - MongoDB ObjectId string of the requesting user
   * @returns The SessionDocument if found and owned by userId
   * @throws NotFoundException when session is not found or userId does not match
   */
  async findByIdForUser(sessionId: string, userId: string): Promise<SessionDocument> {
    const session = await this.sessionModel
      .findOne({ _id: sessionId, userId })
      .exec();

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  /**
   * Cancels an active session by setting status='cancelled' and completedAt to now.
   *
   * @param sessionId - MongoDB ObjectId string of the session
   * @param userId - MongoDB ObjectId string of the requesting user
   * @returns The updated SessionDocument
   * @throws NotFoundException when session is not found or userId does not match
   */
  async cancelSession(sessionId: string, userId: string): Promise<SessionDocument> {
    const session = await this.findByIdForUser(sessionId, userId);

    session.status = 'cancelled';
    session.completedAt = new Date();
    await session.save();

    logger.info('Session cancelled', { userId, sessionId });
    return session;
  }

  /**
   * Atomically appends an event to the session's ring-buffer events array.
   *
   * Uses two atomic MongoDB operations:
   * 1. `$inc: { nextEventId: 1 }` to obtain the next monotonic event id
   * 2. `$push` with `$slice: -100` to append the event and trim to 100 entries
   *
   * @param sessionId - MongoDB ObjectId string of the session
   * @param type - Event type discriminant matching SessionEventUnion['type']
   * @param data - Full event payload as a plain object
   * @returns The assigned event id (monotonically increasing integer)
   */
  async appendEvent(
    sessionId: string,
    type: string,
    data: Record<string, unknown>
  ): Promise<number> {
    const updated = await this.sessionModel.findByIdAndUpdate(
      sessionId,
      { $inc: { nextEventId: 1 } },
      { new: true, projection: { nextEventId: 1 } }
    );

    const eventId = (updated as { nextEventId: number } | null)?.nextEventId ?? 0;
    const timestamp = new Date().toISOString();

    await this.sessionModel.updateOne(
      { _id: sessionId },
      {
        $push: {
          events: {
            $each: [{ id: eventId, type, data, timestamp }],
            $slice: -100,
          },
        },
      }
    );

    return eventId;
  }

  /**
   * Subscribes to the Redis Pub/Sub channel for a session and invokes the
   * handler for each incoming event message.
   *
   * Cleans up the Redis subscription and event listener when the close$ Observable
   * emits.
   *
   * @param sessionId - MongoDB ObjectId string of the session to subscribe to
   * @param handler - Callback invoked with each parsed StoredSessionEvent
   * @param close$ - Observable that signals when the SSE connection should close
   */
  async subscribeToEvents(
    sessionId: string,
    handler: (event: StoredSessionEvent) => void,
    close$: Observable<void>
  ): Promise<void> {
    const channel = `session:${sessionId}:events`;

    const onMessage = (ch: string, message: string): void => {
      if (ch !== channel) return;
      try {
        const event = JSON.parse(message) as StoredSessionEvent;
        handler(event);
      } catch (err) {
        logger.error('Failed to parse Redis event message', { sessionId, err });
      }
    };

    await this.redisSubscriber.subscribe(channel);
    this.redisSubscriber.on('message', onMessage);

    close$.pipe(take(1)).subscribe(() => {
      this.redisSubscriber.removeListener('message', onMessage);
      void this.redisSubscriber.unsubscribe(channel);
      logger.info('SSE connection closed, unsubscribed from Redis channel', { sessionId });
    });
  }

  /**
   * Returns the user's current active session (status: queued or running), or null if none.
   * Used by the frontend to poll session progress without knowing the session ID.
   */
  async getActiveSession(userId: string): Promise<{ session: SessionDocument | null }> {
    const session = await this.sessionModel
      .findOne({ userId, status: { $in: ['queued', 'running'] } })
      .sort({ createdAt: -1 })
      .exec();
    return { session };
  }
}
