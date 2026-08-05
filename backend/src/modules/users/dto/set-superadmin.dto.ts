import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetSuperadminDto {
  @ApiProperty()
  @IsBoolean()
  isSuperadmin: boolean;
}
