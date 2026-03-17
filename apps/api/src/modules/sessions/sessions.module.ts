import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { Session, SessionSchema } from './schemas/session.schema.js';

/**
 * SessionsModule — provides the BullMQ job queue and Mongoose model for
 * the job-search automation pipeline.
 *
 * Responsibilities:
 * - Registers the `search-session` BullMQ queue used to enqueue search runs
 * - Registers the Session Mongoose model for persistence
 *
 * Controllers and services (SessionsController, SessionsService, SseGateway)
 * are added in Plan 02. This module is intentionally minimal so that Plan 01
 * can be committed as a self-contained, compiling unit.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: 'search-session' }),
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class SessionsModule {}
