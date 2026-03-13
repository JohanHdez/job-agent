import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { createPrivateKey } from 'crypto';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LinkedInStrategy } from './strategies/linkedin.strategy.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const privPem = Buffer.from(
          process.env['JWT_PRIVATE_KEY'] ?? '',
          'base64'
        ).toString('utf8');
        const pubPem = Buffer.from(
          process.env['JWT_PUBLIC_KEY'] ?? '',
          'base64'
        ).toString('utf8');
        return {
          privateKey: createPrivateKey(privPem),
          publicKey: pubPem,
          signOptions: { algorithm: 'RS256', expiresIn: '24h' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LinkedInStrategy, GoogleStrategy, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
