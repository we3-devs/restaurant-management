import { ApiProperty } from '@nestjs/swagger';

export class AddonResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ required: false, nullable: true })
  addonGroupId: number | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
