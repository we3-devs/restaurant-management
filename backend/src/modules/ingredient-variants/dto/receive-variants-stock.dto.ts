import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReceiveVariantStockLineDto {
  @ApiProperty({ description: 'The variant (not the parent item) receiving stock' })
  @IsInt()
  variantId: number;

  @ApiProperty({
    example: 3,
    description:
      'Quantity in purchase packages (e.g. cartons) if the variant has unitsPerPackage set, otherwise in the variant’s own base unit',
  })
  @IsNumber()
  @Min(0.0001)
  packages: number;

  @ApiPropertyOptional({ default: 0, description: 'Cost per base unit, not per package' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number = 0;
}

/**
 * One goods receipt covering several size variants of the same base item at
 * once — e.g. "1 carton (4x 250ml)" and "3 cartons (4x 500ml each)" entered
 * and saved together. Internally creates one IngredientStockIn with one item
 * per line and approves it immediately, so each variant's own stock updates
 * separately in the same ledger the regular Stock-In flow uses.
 */
export class ReceiveVariantsStockDto {
  @ApiProperty()
  @IsInt()
  warehouseId: number;

  @ApiProperty({ example: '2026-09-26' })
  @IsISO8601({ strict: true })
  stockInDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ type: [ReceiveVariantStockLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveVariantStockLineDto)
  lines: ReceiveVariantStockLineDto[];
}
