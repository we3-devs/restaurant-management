import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class SendOrderItemsDto {
  @ApiProperty({ type: [Number], description: 'Persisted order item IDs to place.' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  itemIds: number[];
}
