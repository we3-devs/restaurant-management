import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'TemporaryPassword@123' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

