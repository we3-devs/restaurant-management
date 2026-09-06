import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { CustomerCreditTransactionType } from '../entities/customer-credit-transaction.entity';

const CUSTOMER_CREDIT_TRANSACTION_TYPES: CustomerCreditTransactionType[] = [
  'charge',
  'settlement',
  'adjustment',
  'refund_reversal',
];

export class ListCustomerCreditTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional({ enum: CUSTOMER_CREDIT_TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(CUSTOMER_CREDIT_TRANSACTION_TYPES)
  type?: CustomerCreditTransactionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
