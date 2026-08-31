import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SetupAttendanceQrDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) outletId: number;
}

export class ScanAttendanceQrDto {
  @ApiProperty({ description: 'Raw token encoded in the clock-in/out QR code' })
  @IsString() token: string;
}
