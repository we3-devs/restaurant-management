import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';
import { NEPAL_PHONE_PATTERN } from '../../../common/phone';

export class CreateCustomerDto {
  @ApiPropertyOptional({ description: 'Outlet where this customer is being registered' })
  @IsOptional()
  @IsInt()
  outletId?: number;
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @Matches(NEPAL_PHONE_PATTERN, {
    message: 'phone must be a valid Nepal mobile number',
  })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
