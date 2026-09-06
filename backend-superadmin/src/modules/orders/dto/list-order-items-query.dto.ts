import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListOrderItemsQueryDto extends PaginationQueryDto {
  // Required, not optional: an unscoped list would dump order items across
  // every outlet in the system to any caller with orders.view (see
  // OrderItemsController#findAll, which asserts outlet access against this
  // order before listing). No current caller — staff app or backend — lists
  // without an orderId; see use-orders.ts#useOrderItems.
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  orderId: number;
}
