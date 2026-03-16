import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { SearchPresetConfigDto } from './create-preset.dto.js';

/**
 * DTO for updating an existing search preset (PATCH /users/me/presets/:id).
 * Both name and config are optional — partial updates are supported.
 * When config is provided, it must be a complete SearchPresetConfigDto.
 */
export class UpdatePresetDto {
  /** Human-readable name for this preset */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  /**
   * Full search + matching configuration snapshot.
   * If provided, the entire config object is replaced.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchPresetConfigDto)
  config?: SearchPresetConfigDto;
}
