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

  /**
   * Persists a notification. The caller pushes it over the websocket (see
   * KitchenTicketsGateway#notifyNotificationCreated). Pass `recipientUserIds`
   * to scope external-channel delivery to a specific set of users (e.g. cash
   * payments — see getUserIdsByRole) instead of the default outlet-wide fan-out.
   */
  async create(input: Partial<Notification>, recipientUserIds?: number[]): Promise<Notification> {
    const recipients = recipientUserIds ?? await this.getActiveStaffUserIds(input.outletId);
    const notification = await this.notificationsRepository.save(
      this.notificationsRepository.create({ ...input, recipientUserIds: recipients }),
    );
    void this.dispatchExternalChannels(notification, recipients).catch((error: Error) =>
      this.logger.error(`External channel dispatch failed for notification ${notification.id}: ${error.message}`),
    );
    return notification;
  }

  /**
   * Resolves the recipients for a role-scoped notification: superadmins
   * (outlet-independent) plus any user holding one of the given role slugs
   * (e.g. 'manager', 'cashier') via an active assignment on this outlet.
   */
  async getUserIdsByRole(outletId: number, roleSlugs: string[]): Promise<number[]> {
    const [superadmins, assignments] = await Promise.all([
      this.usersRepository.find({ where: { isSuperadmin: true } }),
      roleSlugs.length === 0
        ? Promise.resolve([])
        : this.userRoleAssignmentRepository
            .createQueryBuilder('assignment')
            .innerJoin('assignment.role', 'role')
            .where('assignment.outlet_id = :outletId', { outletId })
            .andWhere('assignment.is_active = true')
            .andWhere('role.is_active = true')
            .andWhere('role.slug IN (:...roleSlugs)', { roleSlugs })
            .select('assignment.user_id', 'userId')
            .getRawMany<{ userId: string }>(),
    ]);
    return [
      ...new Set([
        ...superadmins.map((u) => u.id),
        ...assignments.map((a) => Number(a.userId)),
      ]),
    ];
  }

  /** Active staff means an active assignment on this outlet; superadmins are
   * included because they are outlet-independent administrators. */
  async getActiveStaffUserIds(outletId?: number): Promise<number[]> {
    if (!outletId) return [];
    const [superadmins, assignments] = await Promise.all([
      this.usersRepository.find({ where: { isSuperadmin: true } }),
      this.userRoleAssignmentRepository
        .createQueryBuilder('assignment')
        .innerJoin('assignment.role', 'role')
        .where('assignment.outlet_id = :outletId', { outletId })
        .andWhere('assignment.is_active = true')
        .andWhere('role.is_active = true')
        .select('assignment.user_id', 'userId')
        .getRawMany<{ userId: string }>(),
    ]);
    return [...new Set([
      ...superadmins.map((user) => user.id),
      ...assignments.map((assignment) => Number(assignment.userId)),
    ])];
  }

  /** Creates a notification for only active holders of the requested roles. */
  async createForRoles(
    outletId: number,
    roleSlugs: string[],
    input: Partial<Notification>,
  ): Promise<Notification> {
    const recipientUserIds = await this.getUserIdsByRole(outletId, roleSlugs);
    return this.create({ ...input, outletId }, recipientUserIds);
  }

  /**
   * Fans a notification out to email/SMS/push for every user with a role
   * assignment on the notification's outlet (or, if `recipientUserIds` is
   * given, only those users), filtered by their preferences. In-app (feed +
   * websocket) delivery is unaffected by this — it always happens regardless
   * of these preferences (see the callers of `create`).
   */
  private async dispatchExternalChannels(
    notification: Notification,
    recipientUserIds?: number[],
  ): Promise<void> {
    if (!this.emailService.isConfigured && !this.smsService.isConfigured && !this.pushService.isConfigured) {
      return;
    }

    let userIds: number[];
    if (recipientUserIds) {
      userIds = recipientUserIds;
    } else {
      const assignments = await this.userRoleAssignmentRepository.find({
        where: { outletId: notification.outletId, isActive: true },
      });
      userIds = [...new Set(assignments.map((a) => a.userId))];
    }
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
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
    userId?: number,
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
    } else if (accessibleOutletIds !== 'ALL') {
      qb.andWhere('notification.outlet_id IN (:...accessibleOutletIds)', {
        accessibleOutletIds,
      });
    }
    if (userId !== undefined) {
      qb.andWhere(
        'notification.recipient_user_ids @> CAST(:recipientUserId AS jsonb)',
        { recipientUserId: JSON.stringify([userId]) },
      );
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

    // Three independent round trips run concurrently, not
    // qb.getManyAndCount() (rows then count sequentially, since it's one
    // method call awaiting internally) + a separate count call — that
    // pattern still serializes the two heaviest queries against each other.
    const [data, total, unreadCount] = await Promise.all([
      qb
        .clone()
        .orderBy('notification.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getMany(),
      qb.clone().getCount(),
      qb
        .clone()
        .andWhere('notification.read_at IS NULL')
        .andWhere('notification.archived_at IS NULL')
        .getCount(),
    ]);

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
  async unreadCount(
    outletId?: number,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
    userId?: number,
  ): Promise<{ count: number }> {
    const qb = this.notificationsRepository.createQueryBuilder('notification')
      .where('notification.read_at IS NULL')
      .andWhere('notification.archived_at IS NULL');
    if (outletId !== undefined) qb.andWhere('notification.outlet_id = :outletId', { outletId });
    else if (accessibleOutletIds !== 'ALL') {
      qb.andWhere('notification.outlet_id IN (:...accessibleOutletIds)', { accessibleOutletIds });
    }
    if (userId !== undefined) {
      qb.andWhere(
        'notification.recipient_user_ids @> CAST(:recipientUserId AS jsonb)',
        { recipientUserId: JSON.stringify([userId]) },
      );
    }
    const count = await qb.getCount();
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
