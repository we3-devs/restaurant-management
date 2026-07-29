import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOutletDto {
  @ApiProperty({ example: 'Downtown Branch' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;
}
