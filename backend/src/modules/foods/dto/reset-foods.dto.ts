import { ApiProperty } from '@nestjs/swagger';
import { Equals } from 'class-validator';

/**
 * Requires the caller to echo back a fixed phrase — this wipes the entire
 * food menu for the tenant, so a bare confirmation flag is too easy to send
 * by accident (e.g. a retried request with a stale "confirmed" toggle).
 */
export class ResetFoodsDto {
  @ApiProperty({ enum: ['RESET FOODS'] })
  @Equals('RESET FOODS')
  confirm: string;
}
