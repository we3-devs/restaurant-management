import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class KdsBootstrapQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  outletId: number;
}
