import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Req,
  Res,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { Subject } from 'rxjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SessionsService } from './sessions.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user: UserDocument;
}

/**
 * Extracts userId string from the JWT-populated req.user.
 * Handles both ObjectId and plain string _id values.
 * NF-08: userId ALWAYS comes from the JWT, never from the request body.
 */
function getUserId(req: AuthenticatedRequest): string {
  const id = req.user._id;
  if (id !== null && typeof id === 'object' && 'toHexString' in (id as object)) {
    return (id as { toHexString(): string }).toHexString();
  }
  return String(id);
}

/**
 * SessionsController — REST + SSE interface for job-search automation sessions.
 *
 * Endpoints:
 * - POST   /sessions         — create session, returns 202 with sessionId
 * - GET    /sessions/:id/events — SSE stream with Last-Event-ID replay
 * - DELETE /sessions/:id     — cancel session, returns 200
 */
@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * POST /sessions — create a new search session.
   *
   * Resolves the user's active search preset and embeds the SearchConfigSnapshotType
   * in the session document. Returns 202 with { sessionId } when the session is
   * enqueued successfully.
   *
   * @returns 202 with { sessionId } when session is enqueued successfully
   * @throws ConflictException (409) when user already has an active session
   * @throws BadRequestException (400) when user has no active preset configured
   */
  @Post()
  @HttpCode(202)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() _dto: CreateSessionDto
  ): Promise<{ sessionId: string }> {
    const userId = getUserId(req);
    return this.sessionsService.createSession(userId);
  }

  /**
   * GET /sessions/:id/events — SSE stream for real-time session progress.
   *
   * Protocol:
   * 1. Validates session ownership BEFORE setting any SSE headers
   * 2. Parses Last-Event-ID header for missed event replay
   * 3. Sets SSE response headers and flushes
   * 4. Replays stored events with id > lastEventId
   * 5. Subscribes to Redis Pub/Sub for live events after replay
   *
   * @throws NotFoundException (404) when session not found or ownership mismatch
   */
  @Get(':id/events')
  async streamEvents(
    @Param('id') sessionId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const userId = getUserId(req);

    // Step 1: Validate ownership BEFORE setting SSE headers
    const session = await this.sessionsService.findByIdForUser(sessionId, userId);

    // Step 2: Parse Last-Event-ID for replay
    const lastEventIdHeader = req.headers['last-event-id'];
    const lastEventId = Number(Array.isArray(lastEventIdHeader) ? lastEventIdHeader[0] : (lastEventIdHeader ?? '0'));

    // Step 3: Set SSE headers and flush
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Step 4: Replay stored events missed by the client
    for (const event of session.events.filter((e) => e.id > lastEventId)) {
      res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    }

    // Step 5: Subscribe to Redis Pub/Sub for live events
    const close$ = new Subject<void>();
    req.on('close', () => {
      close$.next();
    });

    await this.sessionsService.subscribeToEvents(
      sessionId,
      (event) => {
        res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      },
      close$
    );
  }

  /**
   * DELETE /sessions/:id — cancel an active session.
   *
   * Sets the session status to 'cancelled' and records completedAt.
   *
   * @returns 200 with the updated session document
   * @throws NotFoundException (404) when session not found or ownership mismatch
   */
  @Delete(':id')
  @HttpCode(200)
  async cancel(
    @Param('id') sessionId: string,
    @Req() req: AuthenticatedRequest
  ) {
    const userId = getUserId(req);
    return this.sessionsService.cancelSession(sessionId, userId);
  }
}
