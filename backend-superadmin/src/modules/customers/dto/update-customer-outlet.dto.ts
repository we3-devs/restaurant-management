import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateCustomerOutletDto {
  @ApiProperty()
  @IsBoolean()
  isFavoriteOutlet: boolean;
}
