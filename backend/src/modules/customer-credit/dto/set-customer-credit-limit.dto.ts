import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class SetCustomerCreditLimitDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  creditLimit: number;
}
