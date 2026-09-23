import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInventoryKitDto {
  @ApiProperty({ example: '8848' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Premium whisky, sold in multiple bottle sizes' })
  @IsOptional()
  @IsString()
  description?: string;
}
