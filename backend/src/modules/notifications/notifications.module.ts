import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';
import { User } from '../users/entities/user.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { EmailService } from './channels/email.service';
import { PushService } from './channels/push.service';
import { SmsService } from './channels/sms.service';
import { Notification } from './entities/notification.entity';
import { NotificationIssue } from './entities/notification-issue.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { NotificationChannelsController } from './notification-channels.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationIssue, NotificationPreference, PushSubscription, User, Attendance]),
    AuthModule,
    RolesModule,
  ],
  controllers: [NotificationsController, NotificationChannelsController],
  providers: [
    NotificationsService,
    NotificationPreferencesService,
    EmailService,
    SmsService,
    PushService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
