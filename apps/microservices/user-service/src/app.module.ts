import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';

/**
 * Root application module.
 *
 * MongoDB URI is read from MONGO_USER_SERVICE_URI (see .env.example).
 * Defaults to localhost for local development.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env['MONGO_USER_SERVICE_URI'] ?? 'mongodb://localhost:27017/user-service',
      }),
    }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
