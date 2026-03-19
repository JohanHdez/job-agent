import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller.js';

/**
 * Health module — wires Terminus and MongoDB health indicators.
 * The controller is registered as @Public() so no JWT is required.
 */
@Module({
  imports: [
    TerminusModule,
    MongooseModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
