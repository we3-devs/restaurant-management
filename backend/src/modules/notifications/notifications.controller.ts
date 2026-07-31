import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { MarkAllNotificationsReadDto } from './dto/mark-all-notifications-read.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary:
      'Paginated, filterable outlet notification feed (type/priority/read/archived/search) plus the unread badge count',
  })
  findAll(@Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.findAll(query);
  }

  @Get('unread-count')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Cheap poll fallback for the bell badge' })
  unreadCount(@Query('outletId') outletId?: string) {
    return this.notificationsService.unreadCount(
      outletId ? Number(outletId) : undefined,
    );
  }

  @Post(':id/read')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Marks a single notification as read' })
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markRead(id);
  }

  @Post('read-all')
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary: 'Marks every unread notification for an outlet as read',
  })
  markAllRead(@Body() dto: MarkAllNotificationsReadDto) {
    return this.notificationsService.markAllRead(dto.outletId);
  }

  @Post(':id/archive')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Archives a notification' })
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.archive(id);
  }

  @Post(':id/unarchive')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Restores an archived notification' })
  unarchive(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.unarchive(id);
  }

  @Delete(':id')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Permanently deletes a notification' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.remove(id);
  }
}
