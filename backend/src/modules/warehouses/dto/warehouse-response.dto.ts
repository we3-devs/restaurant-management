import { ApiProperty } from '@nestjs/swagger';

export class WarehouseResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty({ required: false, nullable: true })
  outletDepartmentId: number | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ required: false, nullable: true })
  address: string | null;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
