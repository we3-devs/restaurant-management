import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SettleCustomerDebtDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  customerId: number;

  @ApiProperty({ description: 'Amount being paid off against the outstanding balance' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Outlet the settlement was collected at — lets it count as that outlet\'s revenue once paid' })
  @Type(() => Number)
  @IsInt()
  outletId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
