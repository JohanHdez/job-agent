import {
  IsArray,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import type { Language, WorkExperience, Education } from '@job-agent/core';

/**
 * DTO for partial profile updates via PATCH /profiles/me.
 * All fields are optional — only provided fields are persisted.
 */
export class PatchProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsIn(['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Executive'])
  seniority?: 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Principal' | 'Executive';

  @IsOptional()
  @IsNumber()
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @IsOptional()
  @IsArray()
  languages?: Language[];

  @IsOptional()
  @IsArray()
  experience?: WorkExperience[];

  @IsOptional()
  @IsArray()
  education?: Education[];
}
