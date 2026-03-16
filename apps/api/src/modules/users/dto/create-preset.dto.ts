import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { PlatformId } from '@job-agent/core';

const VALID_PLATFORMS: PlatformId[] = [
  'linkedin',
  'indeed',
  'computrabajo',
  'bumeran',
  'getonboard',
  'infojobs',
  'greenhouse',
];

const VALID_MODALITIES = ['Remote', 'Hybrid', 'On-site'] as const;
const VALID_DATE_POSTED = ['past_24h', 'past_week', 'past_month'] as const;

/**
 * Nested DTO for the config portion of a search preset.
 * Mirrors AppConfig.search + AppConfig.matching fields.
 */
export class SearchPresetConfigDto {
  @IsArray()
  @IsString({ each: true })
  keywords!: string[];

  @IsString()
  location!: string;

  @IsArray()
  @IsIn(VALID_MODALITIES, { each: true })
  modality!: ('Remote' | 'Hybrid' | 'On-site')[];

  @IsArray()
  @IsString({ each: true })
  languages!: string[];

  @IsArray()
  @IsString({ each: true })
  seniority!: string[];

  @IsIn(VALID_DATE_POSTED)
  datePosted!: 'past_24h' | 'past_week' | 'past_month';

  @IsArray()
  @IsString({ each: true })
  excludedCompanies!: string[];

  @IsArray()
  @IsIn(VALID_PLATFORMS, { each: true })
  platforms!: PlatformId[];

  @IsInt()
  @Min(1)
  maxJobsToFind!: number;

  @IsNumber()
  @Min(0)
  minScoreToApply!: number;

  @IsInt()
  @Min(1)
  maxApplicationsPerSession!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  greenhouseCompanies?: string[];
}

/**
 * DTO for creating a new search preset (POST /users/me/presets).
 */
export class CreatePresetDto {
  /** Human-readable name for this preset */
  @IsString()
  @MaxLength(50)
  name!: string;

  /** Full search + matching configuration snapshot */
  @ValidateNested()
  @Type(() => SearchPresetConfigDto)
  config!: SearchPresetConfigDto;
}
