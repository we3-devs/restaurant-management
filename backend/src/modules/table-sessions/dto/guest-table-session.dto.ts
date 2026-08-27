import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const NEPAL_PHONE_PATTERN = /^(\+?977)?[- ]?9\d{9}$/;

export class JoinTableSessionDto {
  @ApiProperty()
  @IsString()
  tableCode: string;
}

export class AddCompanionDto {
  @ApiProperty()
  @IsString()
  tableCode: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: '+9779800000000' })
  @IsString()
  @Matches(NEPAL_PHONE_PATTERN, {
    message: 'phone must be a valid Nepal mobile number',
  })
  phone: string;
}
