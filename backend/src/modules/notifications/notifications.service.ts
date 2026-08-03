import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { UserRoleAssignment } from '../roles/entities/user-role-assignment.entity';
import { User } from '../users/entities/user.entity';
import { EmailService } from './channels/email.service';
import { PushService } from './channels/push.service';
import { SmsService } from './channels/sms.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Notification } from './entities/notification.entity';

export interface NotificationsFeedResponse extends PaginatedResponse<Notification> {
  unreadCount: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferencesRepository: Repository<NotificationPreference>,
    @InjectRepository(UserRoleAssignment)
    private readonly userRoleAssignmentRepository: Repository<UserRoleAssignment>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly pushService: PushService,
  ) {}

  /** Persists a notification. The caller pushes it over the websocket (see KitchenTicketsGateway#notifyNotificationCreated). */
  async create(input: Partial<Notification>): Promise<Notification> {
    const notification = await this.notificationsRepository.save(
      this.notificationsRepository.create(input),
    );
    void this.dispatchExternalChannels(notification).catch((error: Error) =>
      this.logger.error(`External channel dispatch failed for notification ${notification.id}: ${error.message}`),
    );
    return notification;
  }

  /**
   * Fans a notification out to email/SMS/push for every user with a role
   * assignment on the notification's outlet, filtered by their preferences.
   * In-app (feed + websocket) delivery is unaffected by this — it always
   * happens regardless of these preferences (see the callers of `create`).
   */
  private async dispatchExternalChannels(notification: Notification): Promise<void> {
    if (!this.emailService.isConfigured && !this.smsService.isConfigured && !this.pushService.isConfigured) {
      return;
    }

    const assignments = await this.userRoleAssignmentRepository.find({
      where: { outletId: notification.outletId, isActive: true },
    });
    const userIds = [...new Set(assignments.map((a) => a.userId))];
    if (userIds.length === 0) return;

    const [users, preferenceRows] = await Promise.all([
      this.usersRepository.findBy({ id: In(userIds) }),
      this.preferencesRepository
        .createQueryBuilder('preference')
        .where('preference.user_id IN (:...userIds)', { userIds })
        .getMany(),
    ]);
    const preferenceByUserId = new Map(preferenceRows.map((p) => [p.userId, p]));

    await Promise.all(
      users.map(async (user) => {
        const preference = preferenceByUserId.get(user.id);
        if (!preference || preference.mutedTypes.includes(notification.type)) return;

        const body = notification.body ?? notification.title;
        if (preference.emailEnabled && user.email) {
          await this.emailService.send(user.email, notification.title, body);
        }
        if (preference.smsEnabled && user.phone) {
          await this.smsService.send(user.phone, `${notification.title}: ${body}`);
        }
        if (preference.pushEnabled) {
          await this.pushService.sendToUser(user.id, notification.title, body, {
            type: notification.type,
            orderId: notification.orderId,
          });
        }
      }),
    );
  }

  /** Paginated, filterable feed — also used by the header bell (small limit, page 1, unreadOnly). */
  async findAll(
    query: ListNotificationsQueryDto,
  ): Promise<NotificationsFeedResponse> {
    const {
      page,
      limit,
      outletId,
      type,
      priority,
      read,
      archived,
      search,
      unreadOnly,
    } = query;

    const qb = this.notificationsRepository.createQueryBuilder('notification');
    if (outletId !== undefined) {
      qb.andWhere('notification.outlet_id = :outletId', { outletId });
    }
    if (type !== undefined) {
      qb.andWhere('notification.type = :type', { type });
    }
    if (priority !== undefined) {
      qb.andWhere('notification.priority = :priority', { priority });
    }
    if (unreadOnly || read === false) {
      qb.andWhere('notification.read_at IS NULL');
    } else if (read === true) {
      qb.andWhere('notification.read_at IS NOT NULL');
    }
    if (archived) {
      qb.andWhere('notification.archived_at IS NOT NULL');
    } else {
      qb.andWhere('notification.archived_at IS NULL');
    }
    if (search) {
      qb.andWhere(
        '(notification.title ILIKE :search OR notification.body ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('notification.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const unreadCount = await this.notificationsRepository.count({
      where: {
        ...(outletId !== undefined ? { outletId } : {}),
        readAt: IsNull(),
        archivedAt: IsNull(),
      },
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      unreadCount,
    };
  }

  async findOne(id: number): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    return notification;
  }

  async markRead(id: number): Promise<Notification> {
    const notification = await this.findOne(id);
    notification.readAt = notification.readAt ?? new Date();
    return this.notificationsRepository.save(notification);
  }

  async markAllRead(outletId: number): Promise<{ count: number }> {
    const result = await this.notificationsRepository.update(
      { outletId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { count: result.affected ?? 0 };
  }

  async archive(id: number): Promise<Notification> {
    const notification = await this.findOne(id);
    notification.archivedAt = notification.archivedAt ?? new Date();
    return this.notificationsRepository.save(notification);
  }

  async unarchive(id: number): Promise<Notification> {
    const notification = await this.findOne(id);
    notification.archivedAt = null;
    return this.notificationsRepository.save(notification);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.notificationsRepository.delete(id);
  }

  /** Cheap poll fallback for the bell badge when the socket is down. */
  async unreadCount(outletId?: number): Promise<{ count: number }> {
    const count = await this.notificationsRepository.count({
      where: {
        ...(outletId !== undefined ? { outletId } : {}),
        readAt: IsNull(),
        archivedAt: IsNull(),
      },
    });
    return { count };
  }

  /**
   * Dedupe guard for the BullMQ scan jobs: has an unarchived notification of
   * this type + `data` marker already fired within the window? Avoids
   * re-notifying every 10 minutes for the same low-stock ingredient / delayed
   * ticket while the underlying condition is still true.
   */
  async existsRecent(
    outletId: number,
    type: Notification['type'],
    marker: string,
    sinceMinutesAgo: number,
  ): Promise<boolean> {
    const since = new Date(Date.now() - sinceMinutesAgo * 60_000);
    const count = await this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.outlet_id = :outletId', { outletId })
      .andWhere('notification.type = :type', { type })
      .andWhere('notification.data LIKE :marker', { marker: `%${marker}%` })
      .andWhere('notification.created_at >= :since', { since })
      .andWhere('notification.archived_at IS NULL')
      .getCount();
    return count > 0;
  }
}
