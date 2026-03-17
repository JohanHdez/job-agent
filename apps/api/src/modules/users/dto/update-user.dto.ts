import { IsString, IsOptional, IsIn } from 'class-validator';

/** DTO for PATCH /users/me — editable identity fields (AUTH-04) */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsIn(['en', 'es'])
  languagePreference?: string;
}
