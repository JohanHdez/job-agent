import { IsIn } from 'class-validator';
import type { VacancyStatus } from '@job-agent/core';

/**
 * DTO for PATCH /vacancies/:id/status — update a vacancy's status.
 * Only transitions to 'dismissed', 'applied', and 'failed' are permitted via the API.
 */
export class UpdateVacancyStatusDto {
  @IsIn(['dismissed', 'applied', 'failed'])
  status!: VacancyStatus;
}
