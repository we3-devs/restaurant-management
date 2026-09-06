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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
