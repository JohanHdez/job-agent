import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { fork, ChildProcess } from 'child_process';
import { join } from 'path';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { Session, SessionSchema } from './schemas/session.schema.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

/**
 * SessionsModule — manages session lifecycle, BullMQ queue, and worker process.
 *
 * The BullMQ worker is spawned as a separate Node.js process via child_process.fork
 * for crash isolation. This is a locked architectural decision: a worker crash
 * (e.g. Playwright crash, CAPTCHA loop) must NOT affect the NestJS API process.
 *
 * Worker path resolves relative to the compiled dist/ output:
 * - Compiled module lives at: dist/apps/api/src/modules/sessions/sessions.module.js
 * - Compiled worker lives at: dist/apps/api/src/workers/search-session.worker.js
 * - Relative path from module to worker: ../../workers/search-session.worker.js
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
export class SessionsModule implements OnModuleInit, OnModuleDestroy {
  private worker: ChildProcess | null = null;

  /**
   * Spawn the BullMQ worker as a separate isolated process on module init.
   *
   * The worker connects to Redis and MongoDB independently and processes
   * `search-session` BullMQ jobs. All env vars are passed through so the
   * worker reads REDIS_URL and MONGO_API_URI from the same environment.
   */
  onModuleInit(): void {
    const workerPath = join(__dirname, '../../workers/search-session.worker.js');

    this.worker = fork(workerPath, [], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    this.worker.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(`[worker:stdout] ${data.toString()}`);
    });

    this.worker.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[worker:stderr] ${data.toString()}`);
    });

    this.worker.on('exit', (code: number | null) => {
      process.stderr.write(`[SessionsModule] Worker exited with code ${code}\n`);
      this.worker = null;
      // Production respawn logic: add exponential backoff restart here in Phase 5
    });
  }

  /**
   * Send SIGTERM to the worker process on module destroy for graceful shutdown.
   * The worker's SIGTERM handler closes BullMQ connections, Redis publisher,
   * and Mongoose before exiting.
   */
  onModuleDestroy(): void {
    if (this.worker) {
      this.worker.kill('SIGTERM');
      this.worker = null;
    }
  }
}
