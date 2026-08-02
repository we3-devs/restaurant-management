import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type {
  NotificationPriority,
  NotificationType,
} from '../entities/notification.entity';

const PRIORITIES: NotificationPriority[] = ['normal', 'high', 'urgent'];

/**
 * `@Type(() => Boolean)` runs `Boolean(value)` under the hood, which turns
 * the string "false" into `true` (any non-empty string is truthy) — so a
 * query param like `?archived=false` was silently flipped to `archived:
 * true`. Parses the actual string value instead.
 */
const toBoolean = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value === 'true' : value;

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Notifications are outlet-scoped' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  outletId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: NotificationType;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: NotificationPriority;

  @ApiPropertyOptional({
    description: 'Filter to only read (true) or unread (false)',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  read?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  archived?: boolean = false;

  @ApiPropertyOptional({ description: 'Matches title/body' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Legacy alias for read=false — kept for the header bell',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unreadOnly?: boolean;
}
