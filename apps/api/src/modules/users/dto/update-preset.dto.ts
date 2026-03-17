import { IsString, IsArray, IsNumber, IsOptional, IsIn, Min, Max, MaxLength, MinLength } from 'class-validator';

/** DTO for PATCH /users/presets/:id — update an existing preset */
export class UpdatePresetDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) name?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsArray() @IsIn(['Remote', 'Hybrid', 'On-site'], { each: true }) modality?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) platforms?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) seniority?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @IsOptional() @IsIn(['past_24h', 'past_week', 'past_month']) datePosted?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) minScoreToApply?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(25) maxApplicationsPerSession?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) excludedCompanies?: string[];
}
