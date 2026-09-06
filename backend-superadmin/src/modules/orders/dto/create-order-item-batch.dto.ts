import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';
import { CreateOrderItemAddonDto } from './create-order-item-addon.dto';

export class CreateOrderItemBatchEntryDto extends CreateOrderItemDto {
  @ApiPropertyOptional({ type: [CreateOrderItemAddonDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemAddonDto)
  addons?: CreateOrderItemAddonDto[];
}

export class CreateOrderItemsBatchDto {
  @ApiProperty({ type: [CreateOrderItemBatchEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemBatchEntryDto)
  items: CreateOrderItemBatchEntryDto[];
}
