import { ApiProperty } from '@nestjs/swagger';
import type { OutletDepartmentType } from '../entities/outlet-department.entity';

export class OutletDepartmentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  code: string | null;

  @ApiProperty()
  type: OutletDepartmentType;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  canPrepareOrder: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
