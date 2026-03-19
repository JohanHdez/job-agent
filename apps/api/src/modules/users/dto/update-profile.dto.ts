import { IsString, IsOptional, IsArray, IsNumber, IsIn, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class WorkExperienceDto {
  @IsString() company!: string;
  @IsString() title!: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) description?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) technologies?: string[];
}

class EducationDto {
  @IsString() institution!: string;
  @IsString() degree!: string;
  @IsString() field!: string;
  @IsNumber() graduationYear!: number;
}

class LanguageDto {
  @IsString() name!: string;
  @IsIn(['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic']) level!: string;
}

/** DTO for PATCH /users/profile — mirrors ProfessionalProfile (PROF-03) */
export class UpdateProfileDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() linkedinUrl?: string;
  @IsOptional() @IsString() headline?: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsIn(['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Executive']) seniority?: string;
  @IsOptional() @IsNumber() @Min(0) yearsOfExperience?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) techStack?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LanguageDto) languages?: LanguageDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WorkExperienceDto) experience?: WorkExperienceDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EducationDto) education?: EducationDto[];
}
