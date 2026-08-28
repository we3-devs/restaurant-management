import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { NEPAL_PHONE_PATTERN } from '../../../common/phone';

export class JoinTableSessionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  tableCode: string;
}

export class AddCompanionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
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
