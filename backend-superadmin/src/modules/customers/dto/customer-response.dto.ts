import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class CustomerOutletResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  customerId: number;

  @ApiProperty()
  outletId: number;

  @ApiPropertyOptional({ nullable: true })
  firstVisitedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastVisitedAt: Date | null;

  @ApiProperty()
  visitCount: number;

  @ApiProperty()
  isFavoriteOutlet: boolean;
}
