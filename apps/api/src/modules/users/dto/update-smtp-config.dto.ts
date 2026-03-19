import { IsString, IsNumber, IsBoolean, IsOptional, IsEmail, IsNotEmpty } from 'class-validator';

/**
 * DTO for PUT /users/smtp-config — save or update SMTP configuration (APPLY-02).
 * The password field is expected in plaintext — it will be AES-256-GCM encrypted before storage.
 */
export class UpdateSmtpConfigDto {
  @IsString()
  @IsNotEmpty()
  host!: string;

  @IsNumber()
  port!: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsString()
  @IsNotEmpty()
  user!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;  // plaintext — will be encrypted before storage

  @IsString()
  @IsNotEmpty()
  fromName!: string;

  @IsOptional()
  @IsEmail()
  fromEmail!: string;
}
