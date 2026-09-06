import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SetupAttendanceQrDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) outletId: number;
  @ApiProperty() @IsOptional() @Type(() => Number) @IsInt() @Min(1) tenantId?: number;
}

export class ScanAttendanceQrDto {
  @ApiProperty({ description: 'Raw token encoded in the clock-in/out QR code' })
  @IsString() token: string;
}
