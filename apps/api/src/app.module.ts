import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';

/**
 * Root application module.
 *
 * MongoDB URI is read from MONGO_API_URI (see .env.example).
 * Defaults to localhost for local development.
 *
 * Note: LoggerModule and HealthModule are wired in Plan 02.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env['MONGO_API_URI'] ?? 'mongodb://localhost:27017/job-agent-api',
      }),
    }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
