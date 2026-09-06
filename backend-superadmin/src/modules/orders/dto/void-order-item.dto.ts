import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoidOrderItemDto {
  @ApiProperty({ description: 'Why this item is being voided (required for audit)' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
