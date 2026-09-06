import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { LoyaltyTransactionType } from '../entities/loyalty-transaction.entity';

const LOYALTY_TRANSACTION_TYPES: LoyaltyTransactionType[] = [
  'earn',
  'redeem',
  'adjustment',
  'expiry',
  'refund_reversal',
];

export class ListLoyaltyTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional({ enum: LOYALTY_TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(LOYALTY_TRANSACTION_TYPES)
  type?: LoyaltyTransactionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
