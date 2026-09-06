import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { ServiceRequestType } from '../entities/service-request.entity';
import { SERVICE_REQUEST_TYPES } from './create-service-request.dto';

/**
 * Guest-facing variant: the guest only knows the table's printed code (from
 * the QR URL), never internal IDs. The server resolves the code to a table.
 */
export class CreateGuestServiceRequestDto {
  @ApiProperty({
    description: 'The table code printed on the QR card, e.g. "T8"',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tableCode: string;

  @ApiProperty({ enum: SERVICE_REQUEST_TYPES })
  @IsIn(SERVICE_REQUEST_TYPES)
  type: ServiceRequestType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
