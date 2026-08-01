import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PushService } from './channels/push.service';
import { SubscribePushDto, UnsubscribePushDto } from './dto/push-subscription.dto';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { NotificationPreferencesService } from './notification-preferences.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationChannelsController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
    private readonly pushService: PushService,
  ) {}

  @Get('preferences')
  @ApiOperation({ summary: "Gets the current user's notification channel preferences" })
  getPreferences(@CurrentUser() user: User) {
    return this.preferencesService.getOrCreate(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: "Updates the current user's notification channel preferences" })
  updatePreferences(@CurrentUser() user: User, @Body() dto: UpdateNotificationPreferenceDto) {
    return this.preferencesService.update(user.id, dto);
  }

  @Get('push/public-key')
  @ApiOperation({ summary: 'Gets the VAPID public key used to create a browser push subscription' })
  getPublicKey() {
    return { publicKey: this.pushService.publicKey, configured: this.pushService.isConfigured };
  }

  @Post('push/subscribe')
  @ApiOperation({ summary: "Registers the current browser for push notifications" })
  subscribe(@CurrentUser() user: User, @Body() dto: SubscribePushDto) {
    return this.pushService.subscribe(user.id, dto.endpoint, dto.p256dh, dto.auth);
  }

  @Delete('push/subscribe')
  @ApiOperation({ summary: 'Unregisters a browser push subscription' })
  unsubscribe(@Body() dto: UnsubscribePushDto) {
    return this.pushService.unsubscribe(dto.endpoint);
  }
}
