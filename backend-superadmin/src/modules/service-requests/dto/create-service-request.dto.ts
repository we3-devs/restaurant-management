import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import type { ServiceRequestType } from '../entities/service-request.entity';

export const SERVICE_REQUEST_TYPES: ServiceRequestType[] = [
  'water',
  'bill',
  'assistance',
  'other',
];

export class CreateServiceRequestDto {
  @ApiProperty({ description: 'Dining table the request is for' })
  @IsInt()
  diningTableId: number;

  @ApiProperty({ enum: SERVICE_REQUEST_TYPES })
  @IsIn(SERVICE_REQUEST_TYPES)
  type: ServiceRequestType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
