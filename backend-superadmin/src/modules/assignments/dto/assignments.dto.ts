import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsISO8601 } from 'class-validator';

export class AssignTableDto {
  @ApiProperty() @Type(() => Number) @IsInt() employeeId: number;
  @ApiProperty() @Type(() => Number) @IsInt() diningTableId: number;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @IsInt() sessionId?: number;
  @ApiProperty() @Type(() => Number) @IsInt() outletId: number;
}

export class AssignOrderDto {
  @ApiProperty() @Type(() => Number) @IsInt() employeeId: number;
  @ApiProperty() @Type(() => Number) @IsInt() orderId: number;
  @ApiProperty() @Type(() => Number) @IsInt() outletId: number;
}

export class CompleteOrderAssignmentDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) completedAt?: string;
}

