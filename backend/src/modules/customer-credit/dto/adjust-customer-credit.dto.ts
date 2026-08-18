import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AdjustCustomerCreditDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  customerId: number;

  @ApiProperty({ description: "Signed adjustment to the customer's outstanding balance (positive or negative)" })
  @IsNumber()
  @IsNotEmpty()
  delta: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
