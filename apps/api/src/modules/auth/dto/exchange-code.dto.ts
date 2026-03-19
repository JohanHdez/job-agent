import { IsString, IsUUID } from 'class-validator';

/** DTO for POST /auth/exchange — exchange a one-time code for tokens */
export class ExchangeCodeDto {
  @IsString()
  @IsUUID(4)
  code!: string;
}
