// Mock ESM packages before any imports to prevent import errors
jest.mock('@job-agent/cv-parser', () => ({
  runCvParser: jest.fn(),
}));

jest.mock('../../common/crypto/token-cipher.js', () => ({
  encryptToken: jest.fn().mockReturnValue('encrypted-token'),
}));

jest.mock('@job-agent/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { SessionsService } from './sessions.service.js';
import { Session } from './schemas/session.schema.js';
import { REDIS_SUBSCRIBER } from '../../common/redis/redis-subscriber.provider.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

const makeExec = (returnValue: unknown) =>
  jest.fn().mockResolvedValue(returnValue);

function buildModelMock(overrides: Record<string, jest.Mock> = {}): Record<string, jest.Mock> {
  const base = {
    findOne: jest.fn().mockReturnValue({ exec: makeExec(null) }),
    create: jest.fn(),
    findById: jest.fn().mockReturnValue({ exec: makeExec(null) }),
    findByIdAndUpdate: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  return { ...base, ...overrides };
}

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-id-1' }),
};

const mockRedisSubscriber = {
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  removeListener: jest.fn(),
};

const stubSession = {
  _id: { toHexString: () => 'session-id-1' },
  userId: 'user-a-id',
  status: 'queued' as const,
  config: {},
  events: [] as unknown[],
  nextEventId: 0,
  completedAt: undefined as Date | undefined,
  save: jest.fn().mockResolvedValue(undefined),
};

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('SessionsService', () => {
  let service: SessionsService;
  let modelMock: ReturnType<typeof buildModelMock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    modelMock = buildModelMock();

    // Reset mock implementations
    mockQueue.add.mockResolvedValue({ id: 'job-id-1' });
    mockRedisSubscriber.subscribe.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: getModelToken(Session.name),
          useValue: modelMock,
        },
        {
          provide: getQueueToken('search-session'),
          useValue: mockQueue,
        },
        {
          provide: REDIS_SUBSCRIBER,
          useValue: mockRedisSubscriber,
        },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  // ── createSession ─────────────────────────────────────────────────────────

  describe('createSession', () => {
    it('creates a session document with status=queued and enqueues a BullMQ job', async () => {
      // No active session exists
      modelMock.findOne.mockReturnValue({ exec: makeExec(null) });

      const createdDoc = { ...stubSession };
      modelMock.create.mockResolvedValue(createdDoc);

      const result = await service.createSession('user-a-id', {});

      expect(modelMock.findOne).toHaveBeenCalledWith({
        userId: 'user-a-id',
        status: { $in: ['queued', 'running'] },
      });
      expect(modelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-a-id', status: 'queued' })
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'run-session',
        expect.objectContaining({ sessionId: 'session-id-1', userId: 'user-a-id' }),
        expect.objectContaining({ attempts: 2 })
      );
      expect(result).toEqual({ sessionId: 'session-id-1' });
    });

    it('throws ConflictException with SESSION_ALREADY_ACTIVE when an active session exists', async () => {
      const activeSession = { ...stubSession, status: 'running' as const };
      modelMock.findOne.mockReturnValue({ exec: makeExec(activeSession) });

      await expect(service.createSession('user-a-id', {})).rejects.toThrow(ConflictException);

      try {
        await service.createSession('user-a-id', {});
      } catch (err) {
        const conflict = err as ConflictException;
        const response = conflict.getResponse() as Record<string, unknown>;
        expect(response['code']).toBe('SESSION_ALREADY_ACTIVE');
        expect(response['sessionId']).toBe('session-id-1');
      }
    });
  });

  // ── findByIdForUser ───────────────────────────────────────────────────────

  describe('findByIdForUser', () => {
    it('returns the session document when userId matches', async () => {
      modelMock.findOne.mockReturnValue({ exec: makeExec(stubSession) });

      const result = await service.findByIdForUser('session-id-1', 'user-a-id');

      expect(modelMock.findOne).toHaveBeenCalledWith({
        _id: 'session-id-1',
        userId: 'user-a-id',
      });
      expect(result).toEqual(stubSession);
    });

    it('throws NotFoundException when session not found or userId mismatch', async () => {
      modelMock.findOne.mockReturnValue({ exec: makeExec(null) });

      await expect(service.findByIdForUser('bad-id', 'user-a-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ── cancelSession ─────────────────────────────────────────────────────────

  describe('cancelSession', () => {
    it('sets status=cancelled and completedAt on the session', async () => {
      const sessionDoc = { ...stubSession, save: jest.fn().mockResolvedValue(undefined) };
      modelMock.findOne.mockReturnValue({ exec: makeExec(sessionDoc) });

      const result = await service.cancelSession('session-id-1', 'user-a-id');

      expect(sessionDoc.status).toBe('cancelled');
      expect(sessionDoc.completedAt).toBeDefined();
      expect(sessionDoc.save).toHaveBeenCalled();
      expect(result).toEqual(sessionDoc);
    });

    it('throws NotFoundException for invalid or mismatched session', async () => {
      modelMock.findOne.mockReturnValue({ exec: makeExec(null) });

      await expect(service.cancelSession('bad-id', 'user-a-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ── appendEvent ───────────────────────────────────────────────────────────

  describe('appendEvent', () => {
    it('increments nextEventId via $inc and appends event with $push $slice: -100', async () => {
      const updatedDoc = { nextEventId: 5 };
      modelMock.findByIdAndUpdate.mockResolvedValue(updatedDoc);
      modelMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const eventId = await service.appendEvent('session-id-1', 'job_found', { jobId: 'j1' });

      expect(modelMock.findByIdAndUpdate).toHaveBeenCalledWith(
        'session-id-1',
        { $inc: { nextEventId: 1 } },
        expect.objectContaining({ new: true })
      );
      expect(modelMock.updateOne).toHaveBeenCalledWith(
        { _id: 'session-id-1' },
        expect.objectContaining({
          $push: expect.objectContaining({
            events: expect.objectContaining({
              $slice: -100,
            }),
          }),
        })
      );
      expect(eventId).toBe(5);
    });

    it('returns the assigned event id (nextEventId value after increment)', async () => {
      modelMock.findByIdAndUpdate.mockResolvedValue({ nextEventId: 42 });
      modelMock.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const id = await service.appendEvent('session-id-1', 'session_complete', {});
      expect(id).toBe(42);
    });
  });

  // ── subscribeToEvents ─────────────────────────────────────────────────────

  describe('subscribeToEvents', () => {
    it('subscribes to Redis channel and calls handler on message', async () => {
      const close$ = new Subject<void>();
      const handler = jest.fn();

      // Capture the onMessage callback
      let capturedCallback: ((channel: string, message: string) => void) | null = null;
      mockRedisSubscriber.on.mockImplementation(
        (_event: string, cb: (channel: string, message: string) => void) => {
          capturedCallback = cb;
        }
      );

      await service.subscribeToEvents('session-id-1', handler, close$);

      expect(mockRedisSubscriber.subscribe).toHaveBeenCalledWith(
        'session:session-id-1:events'
      );

      // Simulate a Redis message
      const storedEvent = { id: 1, type: 'job_found', data: { jobId: 'j1' }, timestamp: '2026-01-01T00:00:00Z' };
      if (capturedCallback != null) {
        (capturedCallback as (ch: string, msg: string) => void)('session:session-id-1:events', JSON.stringify(storedEvent));
      }

      expect(handler).toHaveBeenCalledWith(storedEvent);
    });

    it('unsubscribes and removes listener on close$ signal', async () => {
      const close$ = new Subject<void>();
      const handler = jest.fn();

      await service.subscribeToEvents('session-id-1', handler, close$);

      // Trigger close
      close$.next();

      expect(mockRedisSubscriber.removeListener).toHaveBeenCalled();
      expect(mockRedisSubscriber.unsubscribe).toHaveBeenCalledWith(
        'session:session-id-1:events'
      );
    });
  });
});
