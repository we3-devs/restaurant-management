import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/**
 * outletId is required — omitting it would let a WHERE-less update sweep
 * every notification across all outlets.
 */
export class MarkAllNotificationsReadDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  outletId: number;
}
