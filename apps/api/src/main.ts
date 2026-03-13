import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { createLogger } from '@job-agent/logger';
import { AppModule } from './app.module.js';

const logger = createLogger('api');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    cors: {
      origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
      credentials: true,
    },
  });

  // Global validation pipe — strips unknown fields, enables whitelist
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    })
  );

  const port = parseInt(process.env['API_PORT'] ?? '3001', 10);
  await app.listen(port);

  logger.info('API server started', { port });
  logger.info('LinkedIn OAuth endpoint', { url: `http://localhost:${port}/auth/linkedin` });
  logger.info('Google OAuth endpoint', { url: `http://localhost:${port}/auth/google` });
  logger.info('JWT refresh endpoint', { url: `POST http://localhost:${port}/auth/refresh` });
}

bootstrap().catch((err: unknown) => {
  logger.error('Fatal startup error', { error: String(err) });
  process.exit(1);
});
