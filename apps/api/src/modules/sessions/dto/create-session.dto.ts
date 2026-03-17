import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for POST /sessions.
 * Session config is read from the user's active search preset in MongoDB.
 * An optional presetId can override which preset to use.
 */
export class CreateSessionDto {
  @IsOptional()
  @IsString()
  presetId?: string;
}
