import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vacancy, VacancySchema } from './schemas/vacancy.schema.js';
import { VacanciesService } from './vacancies.service.js';
import { VacanciesController } from './vacancies.controller.js';

/**
 * VacanciesModule — registers the Vacancy Mongoose model and exposes
 * REST endpoints for vacancy history queries and the dismiss feature.
 *
 * Exports MongooseModule so downstream modules (e.g. SessionsModule
 * in Phase 4) can inject the InjectModel(Vacancy.name) token directly.
 * Exports VacanciesService so the pipeline worker can call insertMany.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vacancy.name, schema: VacancySchema }]),
  ],
  controllers: [VacanciesController],
  providers: [VacanciesService],
  exports: [VacanciesService, MongooseModule],
})
export class VacanciesModule {}
