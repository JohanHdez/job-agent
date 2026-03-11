import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { WinstonLoggerService } from './common/logger.service.js';

/**
 * Bootstrap the user-service NestJS application.
 * Uses the shared WinstonLoggerService for structured logging.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: {
      origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
      credentials: true,
    },
  });

  // Wire the shared Winston logger into NestJS
  app.useLogger(app.get(WinstonLoggerService));

  // Global validation pipe — strips unknown fields, enables whitelist
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const port = parseInt(process.env['USER_SERVICE_PORT'] ?? '3001', 10);
  await app.listen(port);
  process.stdout.write(`[user-service] Running at http://localhost:${port}\n`);
  process.stdout.write(
    `[user-service] LinkedIn OAuth: http://localhost:${port}/auth/linkedin\n`,
  );
  process.stdout.write(
    `[user-service] Google OAuth:   http://localhost:${port}/auth/google\n`,
  );
  process.stdout.write(
    `[user-service] JWT refresh:    POST http://localhost:${port}/auth/refresh\n`,
  );
}

bootstrap().catch((err) => {
  process.stderr.write(`[user-service] Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
