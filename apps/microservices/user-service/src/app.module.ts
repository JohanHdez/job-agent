import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WinstonLoggerService } from './common/logger.service.js';

/**
 * Root application module.
 *
 * MongoDB URI is read from MONGO_USER_SERVICE_URI (see .env.example).
 * Defaults to localhost for local development.
 */
@Module({
  imports: [
    // Search for .env in the workspace dir first, then walk up to the monorepo root.
    // This covers both `npm run dev` from the package dir and workspace `-w` invocations.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../../.env'] }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri:
          process.env['MONGO_USER_SERVICE_URI'] ??
          'mongodb://localhost:27017/user-service',
      }),
    }),
    UsersModule,
    AuthModule,
  ],
  providers: [WinstonLoggerService],
  exports: [WinstonLoggerService],
})
export class AppModule {}
