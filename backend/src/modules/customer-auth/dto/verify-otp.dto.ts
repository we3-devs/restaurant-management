import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

export class VerifyOtpDto {
  @ApiPropertyOptional({ example: '+9779800000000' })
  @ValidateIf((dto: VerifyOtpDto) => !dto.email)
  @IsString()
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
