import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SubscribePushDto {
  @ApiProperty() @IsString() endpoint: string;
  @ApiProperty() @IsString() p256dh: string;
  @ApiProperty() @IsString() auth: string;
}

export class UnsubscribePushDto {
  @ApiProperty() @IsString() endpoint: string;
}
