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
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

const mockSession = {
  _id: { toHexString: () => 'session-id-1' },
  userId: 'user-a-id',
  status: 'queued',
  config: {},
  events: [],
  nextEventId: 0,
};

const mockSessionsService = {
  createSession: jest.fn(),
  findByIdForUser: jest.fn(),
  cancelSession: jest.fn(),
  appendEvent: jest.fn(),
  subscribeToEvents: jest.fn(),
};

/** Build a mock AuthenticatedRequest with a given userId */
function mockReq(userId: string) {
  return {
    user: {
      _id: { toHexString: () => userId },
    },
    headers: {} as Record<string, string>,
    on: jest.fn(),
  };
}

function mockRes() {
  return {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let controller: SessionsController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module: TestingModule = await Test.createTestingModule({
    controllers: [SessionsController],
    providers: [
      { provide: SessionsService, useValue: mockSessionsService },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  controller = module.get<SessionsController>(SessionsController);
});

// ── POST /sessions ────────────────────────────────────────────────────────────

describe('POST /sessions', () => {
  it('calls createSession with userId from JWT and returns 202 with sessionId', async () => {
    mockSessionsService.createSession.mockResolvedValue({ sessionId: 'session-id-1' });

    const req = mockReq('user-a-id');
    const result = await controller.create(req as never, {});

    expect(mockSessionsService.createSession).toHaveBeenCalledWith('user-a-id', {});
    expect(result).toEqual({ sessionId: 'session-id-1' });
  });

  it('propagates ConflictException when service throws SESSION_ALREADY_ACTIVE', async () => {
    mockSessionsService.createSession.mockRejectedValue(
      new ConflictException({ code: 'SESSION_ALREADY_ACTIVE', sessionId: 'existing-id' })
    );

    const req = mockReq('user-a-id');
    await expect(controller.create(req as never, {})).rejects.toThrow(ConflictException);
  });
});

// ── GET /sessions/:id/events ──────────────────────────────────────────────────

describe('GET /sessions/:id/events', () => {
  it('calls findByIdForUser before setting SSE headers (validation-first)', async () => {
    mockSessionsService.findByIdForUser.mockResolvedValue({
      ...mockSession,
      events: [],
    });
    mockSessionsService.subscribeToEvents.mockResolvedValue(undefined);

    const req = mockReq('user-a-id');
    const res = mockRes();

    await controller.streamEvents('session-id-1', req as never, res as never);

    expect(mockSessionsService.findByIdForUser).toHaveBeenCalledWith('session-id-1', 'user-a-id');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
  });

  it('returns 404 when findByIdForUser throws NotFoundException', async () => {
    mockSessionsService.findByIdForUser.mockRejectedValue(new NotFoundException('Session not found'));

    const req = mockReq('user-a-id');
    const res = mockRes();

    await expect(controller.streamEvents('session-id-1', req as never, res as never)).rejects.toThrow(
      NotFoundException
    );
    // SSE headers must NOT be set before validation
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('sets all required SSE headers after successful validation', async () => {
    mockSessionsService.findByIdForUser.mockResolvedValue({ ...mockSession, events: [] });
    mockSessionsService.subscribeToEvents.mockResolvedValue(undefined);

    const req = mockReq('user-a-id');
    const res = mockRes();

    await controller.streamEvents('session-id-1', req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(res.flushHeaders).toHaveBeenCalled();
  });

  it('replays stored events with id > lastEventId from Last-Event-ID header', async () => {
    const storedEvents = [
      { id: 1, type: 'job_found', data: { jobId: 'j1' }, timestamp: '2026-01-01T00:00:00Z' },
      { id: 2, type: 'job_found', data: { jobId: 'j2' }, timestamp: '2026-01-01T00:00:01Z' },
      { id: 3, type: 'job_skipped', data: { jobId: 'j3' }, timestamp: '2026-01-01T00:00:02Z' },
    ];
    mockSessionsService.findByIdForUser.mockResolvedValue({ ...mockSession, events: storedEvents });
    mockSessionsService.subscribeToEvents.mockResolvedValue(undefined);

    const req = { ...mockReq('user-a-id'), headers: { 'last-event-id': '1' } };
    const res = mockRes();

    await controller.streamEvents('session-id-1', req as never, res as never);

    // Should only replay events with id > 1 (i.e., ids 2 and 3)
    const writeCalls = (res.write as jest.Mock).mock.calls as string[][];
    expect(writeCalls).toHaveLength(2);
    expect(writeCalls[0][0]).toContain('id: 2');
    expect(writeCalls[1][0]).toContain('id: 3');
  });
});

// ── DELETE /sessions/:id ──────────────────────────────────────────────────────

describe('DELETE /sessions/:id', () => {
  it('calls cancelSession with userId from JWT and sessionId, returns updated session', async () => {
    const cancelledSession = { ...mockSession, status: 'cancelled' };
    mockSessionsService.cancelSession.mockResolvedValue(cancelledSession);

    const req = mockReq('user-a-id');
    const result = await controller.cancel('session-id-1', req as never);

    expect(mockSessionsService.cancelSession).toHaveBeenCalledWith('session-id-1', 'user-a-id');
    expect(result).toEqual(cancelledSession);
  });

  it('propagates NotFoundException when cancelSession throws', async () => {
    mockSessionsService.cancelSession.mockRejectedValue(new NotFoundException('Session not found'));

    const req = mockReq('user-a-id');
    await expect(controller.cancel('bad-id', req as never)).rejects.toThrow(NotFoundException);
  });
});
