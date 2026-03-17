import { IsString, IsArray, IsNumber, IsOptional, IsIn, Min, Max, MaxLength, MinLength } from 'class-validator';

/** DTO for POST /users/presets — create a named search preset (SRCH-01) */
export class CreatePresetDto {
  @IsString() @MinLength(1) @MaxLength(50) name!: string;
  @IsArray() @IsString({ each: true }) keywords!: string[];
  @IsString() location!: string;
  @IsArray() @IsIn(['Remote', 'Hybrid', 'On-site'], { each: true }) modality!: string[];
  @IsArray() @IsString({ each: true }) platforms!: string[];
  @IsArray() @IsString({ each: true }) seniority!: string[];
  @IsArray() @IsString({ each: true }) languages!: string[];
  @IsIn(['past_24h', 'past_week', 'past_month']) datePosted!: string;
  @IsNumber() @Min(0) @Max(100) minScoreToApply!: number;
  @IsNumber() @Min(1) @Max(25) maxApplicationsPerSession!: number;
  @IsOptional() @IsArray() @IsString({ each: true }) excludedCompanies?: string[];
}
