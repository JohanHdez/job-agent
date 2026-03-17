import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { Session, SessionSchema } from './schemas/session.schema.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

/**
 * SessionsModule — provides the BullMQ job queue, Mongoose model,
 * REST controller, and service for the job-search automation pipeline.
 *
 * Responsibilities:
 * - Registers the `search-session` BullMQ queue used to enqueue search runs
 * - Registers the Session Mongoose model for persistence
 * - Exposes SessionsController (POST /sessions, GET /:id/events, DELETE /:id)
 * - Provides SessionsService for session CRUD, event appending, and SSE Pub/Sub
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: 'search-session' }),
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
