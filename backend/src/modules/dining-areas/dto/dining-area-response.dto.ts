import { ApiProperty } from '@nestjs/swagger';

export class DiningAreaResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  outletId: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  code: string | null;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty()
  layoutWidth: number;

  @ApiProperty()
  layoutHeight: number;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
