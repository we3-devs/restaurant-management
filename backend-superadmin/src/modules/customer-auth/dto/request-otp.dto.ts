import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { NEPAL_PHONE_PATTERN } from '../../../common/phone';

// Loose E.164-ish check: optional leading +, 7-15 digits, no leading zero.
export class RequestOtpDto {
  @ApiPropertyOptional({ example: '+9779800000000' })
  @ValidateIf((dto: RequestOtpDto) => !dto.email)
  @IsString()
  @Matches(NEPAL_PHONE_PATTERN, { message: 'phone must be a valid Nepal mobile number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @ValidateIf((dto: RequestOtpDto) => !dto.phone)
  @IsEmail()
  @IsOptional()
  email?: string;
}
