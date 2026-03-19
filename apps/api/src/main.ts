import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { createLogger } from '@job-agent/logger';
import { AppModule } from './app.module';

const logger = createLogger('api');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    cors: {
      // Use a function so the origin is resolved per-request, AFTER ConfigModule
      // has loaded .env into process.env (static string is evaluated at bootstrap
      // time before dotenv runs, so it would always fall back to the default).
      origin: (_origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        const allowed = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
        cb(null, !_origin || _origin === allowed);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
  });

  // Enable cookie parsing — required for httpOnly refresh token cookie in /auth/refresh
  app.use(cookieParser());

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
  logger.info('Code-exchange endpoint', { url: `POST http://localhost:${port}/auth/exchange` });
  logger.info('JWT refresh endpoint', { url: `POST http://localhost:${port}/auth/refresh` });
}

bootstrap().catch((err: unknown) => {
  logger.error('Fatal startup error', { error: String(err) });
  process.exit(1);
});
