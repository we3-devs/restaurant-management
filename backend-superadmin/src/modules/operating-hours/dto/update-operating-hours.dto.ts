import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateOperatingHoursDto {
  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  openingTime?: string;

  @ApiPropertyOptional({ example: '23:00' })
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  closingTime?: string;

  @ApiPropertyOptional({ example: 'Asia/Kathmandu' })
  @IsOptional() @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  enabled?: boolean;
}
