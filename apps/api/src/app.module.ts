import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { LoggerModule } from './modules/logger/logger.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { CorrelationInterceptor } from './common/interceptors/correlation.interceptor.js';

/**
 * Root application module.
 *
 * MongoDB URI is read from MONGO_API_URI (see .env.example).
 * Defaults to localhost for local development.
 *
 * Infrastructure:
 *   - LoggerModule: @Global() Winston logger with correlationId via AsyncLocalStorage
 *   - HealthModule: GET /health with MongoDB health indicator
 *   - JwtAuthGuard: APP_GUARD — all routes require JWT unless decorated @Public()
 *   - CorrelationInterceptor: APP_INTERCEPTOR — attaches correlationId to every request
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env['MONGO_API_URI'] ?? 'mongodb://localhost:27017/job-agent-api',
      }),
    }),
    LoggerModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ProfilesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: CorrelationInterceptor },
  ],
})
export class AppModule {}
