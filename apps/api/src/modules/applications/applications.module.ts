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
import { Application, ApplicationSchema } from './schemas/application.schema.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';
import { EmailSenderService } from './email-sender.service.js';
import { ClaudeEmailDraftAdapter } from '../../workers/adapters/claude-email-draft.adapter.js';
import { VacanciesModule } from '../vacancies/vacancies.module.js';
import { UsersModule } from '../users/users.module.js';

/** Injection token for the EmailDraftAdapter — enables swapping without code changes */
export const EMAIL_DRAFT_ADAPTER_TOKEN = Symbol('EMAIL_DRAFT_ADAPTER_TOKEN');

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Application.name, schema: ApplicationSchema }]),
    VacanciesModule,
    UsersModule,
  ],
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    EmailSenderService,
    {
      provide: EMAIL_DRAFT_ADAPTER_TOKEN,
      useFactory: () => {
        const apiKey = process.env['ANTHROPIC_API_KEY'];
        if (!apiKey) {
          throw new Error(
            'ANTHROPIC_API_KEY environment variable is required for email draft generation'
          );
        }
        return new ClaudeEmailDraftAdapter(apiKey);
      },
    },
  ],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
