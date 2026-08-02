import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

// Loose E.164-ish check: optional leading +, 7-15 digits, no leading zero.
const PHONE_PATTERN = /^\+?[1-9]\d{6,14}$/;

export class VerifyOtpDto {
  @ApiPropertyOptional({ example: '+9779800000000' })
  @ValidateIf((dto: VerifyOtpDto) => !dto.email)
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @ValidateIf((dto: VerifyOtpDto) => !dto.phone)
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiPropertyOptional({ description: 'Display name, used only on first sign-in' })
  @IsOptional()
  @IsString()
  name?: string;
}
