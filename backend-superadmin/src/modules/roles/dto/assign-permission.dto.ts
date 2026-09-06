import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AssignPermissionDto {
  @ApiProperty()
  @IsInt()
  permissionId: number;
}
