import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, ValidateIf } from 'class-validator';

export class RequestOtpDto {
  @ApiPropertyOptional({ example: '+9779800000000' })
  @ValidateIf((dto: RequestOtpDto) => !dto.email)
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @ValidateIf((dto: RequestOtpDto) => !dto.phone)
  @IsEmail()
  @IsOptional()
  email?: string;
}
