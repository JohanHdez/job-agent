import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

/**
 * DTO for updating a user's own profile (PATCH /users/me).
 * All fields are optional — partial updates are supported.
 */
export class UpdateUserDto {
  /** User's display name */
  @IsOptional()
  @IsString()
  name?: string;

  /** User's email address */
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Preferred UI language */
  @IsOptional()
  @IsIn(['en', 'es'])
  language?: 'en' | 'es';
}
