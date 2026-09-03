import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

const PUSH_APPS = ['operational', 'dashboard'] as const;

export class SubscribePushDto {
  @ApiProperty() @IsString() endpoint: string;
  @ApiProperty() @IsString() p256dh: string;
  @ApiProperty() @IsString() auth: string;
  @ApiProperty({ enum: PUSH_APPS }) @IsIn(PUSH_APPS) app: (typeof PUSH_APPS)[number];
}

export class UnsubscribePushDto {
  @ApiProperty() @IsString() endpoint: string;
}
