import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class GuestSessionDto {
  @ApiPropertyOptional({
    description: 'Dining table the guest scanned a QR code at',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  tableId?: number;
}
