import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

// Loose E.164-ish check: optional leading +, 7-15 digits, no leading zero.
const PHONE_PATTERN = /^\+?[1-9]\d{6,14}$/;

export class RequestOtpDto {
  @ApiPropertyOptional({ example: '+9779800000000' })
  @ValidateIf((dto: RequestOtpDto) => !dto.email)
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @ValidateIf((dto: RequestOtpDto) => !dto.phone)
  @IsEmail()
  @IsOptional()
  email?: string;
}
