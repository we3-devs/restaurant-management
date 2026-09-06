import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'jane@rms.local' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'Initial password, set directly by the admin',
  })
  @IsString()
  @MinLength(8)
  password: string;
}
