import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vacancy, VacancySchema } from './schemas/vacancy.schema.js';
import { Application, ApplicationSchema } from '../applications/schemas/application.schema.js';
import { VacanciesService } from './vacancies.service.js';
import { VacanciesController } from './vacancies.controller.js';

/**
 * VacanciesModule — registers the Vacancy Mongoose model and exposes
 * REST endpoints for vacancy history queries and the dismiss feature.
 *
 * Exports MongooseModule so downstream modules (e.g. SessionsModule
 * in Phase 4) can inject the InjectModel(Vacancy.name) token directly.
 * Exports VacanciesService so the pipeline worker can call insertMany.
 *
 * Also imports the Application schema as a read-only dependency so
 * VacanciesService can join applicationStatus when includeApplication=true.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vacancy.name, schema: VacancySchema },
      { name: Application.name, schema: ApplicationSchema },
    ]),
  ],
  controllers: [VacanciesController],
  providers: [VacanciesService],
  exports: [VacanciesService, MongooseModule],
})
export class VacanciesModule {}
