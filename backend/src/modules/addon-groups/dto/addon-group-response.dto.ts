import { ApiProperty } from '@nestjs/swagger';

export class AddonGroupResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty()
  minSelect: number;

  @ApiProperty({ required: false, nullable: true })
  maxSelect: number | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
