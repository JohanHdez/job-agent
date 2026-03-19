/**
 * ApplicationsModule — manages the full application lifecycle:
 * draft creation, email generation via Claude, SMTP dispatch, and history tracking.
 *
 * Uses a custom injection token (EMAIL_DRAFT_ADAPTER_TOKEN) for the email draft adapter,
 * making it swappable without changing ApplicationsService (e.g. disable for free-tier users).
 *
 * DI wiring:
 * - ClaudeEmailDraftAdapter is registered as a factory provider with EMAIL_DRAFT_ADAPTER_TOKEN
 * - ApplicationsService receives EmailDraftAdapter via @Inject(EMAIL_DRAFT_ADAPTER_TOKEN)
 * - VacanciesModule is imported for Vacancy model access
 * - UsersModule is imported for user profile + SMTP config access
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { Application, ApplicationSchema } from './schemas/application.schema.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';
import { EmailSenderService } from './email-sender.service.js';
import { createEmailDraftAdapter } from '../../workers/adapters/ai-provider.factory.js';
import { VacanciesModule } from '../vacancies/vacancies.module.js';
import { UsersModule } from '../users/users.module.js';
import { EMAIL_DRAFT_ADAPTER_TOKEN } from './applications.tokens.js';

export { EMAIL_DRAFT_ADAPTER_TOKEN } from './applications.tokens.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Application.name, schema: ApplicationSchema }]),
    BullModule.registerQueue({ name: 'applications' }),
    VacanciesModule,
    UsersModule,
  ],
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    EmailSenderService,
    {
      provide: EMAIL_DRAFT_ADAPTER_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const anthropicKey = config.get<string>('ANTHROPIC_API_KEY');
        const geminiKey = config.get<string>('GEMINI_API_KEY');
        return createEmailDraftAdapter(anthropicKey, geminiKey);
      },
    },
  ],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
