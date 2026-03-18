import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vacancy, VacancySchema } from './schemas/vacancy.schema.js';

/**
 * VacanciesModule — registers the Vacancy Mongoose model for injection
 * into feature modules that need to read or write vacancy documents.
 *
 * Exports MongooseModule so downstream modules (e.g. SessionsModule
 * in Phase 4) can inject the InjectModel(Vacancy.name) token directly.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vacancy.name, schema: VacancySchema }]),
  ],
  exports: [MongooseModule],
})
export class VacanciesModule {}
