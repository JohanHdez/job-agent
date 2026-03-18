import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { LoggerModule } from './modules/logger/logger.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { VacanciesModule } from './modules/vacancies/vacancies.module.js';
import { ApplicationsModule } from './modules/applications/applications.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { CorrelationMiddleware } from './common/middleware/correlation.middleware.js';

/**
 * Root application module.
 *
 * MongoDB URI is read from MONGO_API_URI (see .env.example).
 * Defaults to localhost for local development.
 *
 * Request pipeline order (NestJS):
 *   1. CorrelationMiddleware  — sets correlationId in AsyncLocalStorage (before guards)
 *   2. JwtAuthGuard           — APP_GUARD, protects all routes unless @Public()
 *   3. LoggingInterceptor     — logs → METHOD /path and ← STATUS Xms
 *   4. HttpExceptionFilter    — catches all errors, logs with full stack + correlationId
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env['MONGO_API_URI'] ?? 'mongodb://localhost:27017/job-agent-api',
      }),
    }),
    LoggerModule,
    HealthModule,
    RedisModule,
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: { url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' },
      }),
    }),
    UsersModule,
    AuthModule,
    SessionsModule,
    VacanciesModule,
    ApplicationsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
