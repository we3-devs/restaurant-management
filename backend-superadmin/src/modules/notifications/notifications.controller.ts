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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { MarkAllNotificationsReadDto } from './dto/mark-all-notifications-read.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  /** Resolves the notification and asserts outlet access — same choke-point pattern as OrdersController#assertOrderAccess. */
  private async assertNotificationAccess(id: number, user: User) {
    const notification = await this.notificationsService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      notification.outletId,
    );
    return notification;
  }

  @Get()
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary:
      'Paginated, filterable outlet notification feed (type/priority/read/archived/search) plus the unread badge count',
  })
  async findAll(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: User,
  ) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(
      user.id,
      user.isSuperadmin,
    );
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(
        user.id,
        user.isSuperadmin,
        query.outletId,
      );
    }
    return this.notificationsService.findAll(query, accessible, user.id);
  }

  @Get('unread-count')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Cheap poll fallback for the bell badge' })
  async unreadCount(
    @Query('outletId') outletId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const parsedOutletId = outletId ? Number(outletId) : undefined;
    const accessible = await this.outletAccess.getAccessibleOutletIds(
      user.id,
      user.isSuperadmin,
    );
    if (accessible !== 'ALL' && parsedOutletId !== undefined) {
      await this.outletAccess.assertOutletAccess(
        user.id,
        user.isSuperadmin,
        parsedOutletId,
      );
    }
    return this.notificationsService.unreadCount(parsedOutletId, accessible, user.id);
  }

  @Post(':id/read')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Marks a single notification as read' })
  async markRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertNotificationAccess(id, user);
    return this.notificationsService.markRead(id);
  }

  @Post('read-all')
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary: 'Marks every unread notification for an outlet as read',
  })
  async markAllRead(
    @Body() dto: MarkAllNotificationsReadDto,
    @CurrentUser() user: User,
  ) {
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      dto.outletId,
    );
    return this.notificationsService.markAllRead(dto.outletId);
  }

  @Post(':id/archive')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Archives a notification' })
  async archive(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertNotificationAccess(id, user);
    return this.notificationsService.archive(id);
  }

  @Post(':id/unarchive')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Restores an archived notification' })
  async unarchive(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertNotificationAccess(id, user);
    return this.notificationsService.unarchive(id);
  }

  @Delete(':id')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Permanently deletes a notification' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertNotificationAccess(id, user);
    return this.notificationsService.remove(id);
  }
}
