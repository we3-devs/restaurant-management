import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { User } from '../users/entities/user.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { EmailService } from './channels/email.service';
import { PushService } from './channels/push.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Notification } from './entities/notification.entity';
import { NotificationIssue } from './entities/notification-issue.entity';

export interface NotificationsFeedResponse extends PaginatedResponse<Notification> {
  unreadCount: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(NotificationIssue)
    private readonly notificationIssuesRepository: Repository<NotificationIssue>,
    @InjectRepository(NotificationPreference)
    private readonly preferencesRepository: Repository<NotificationPreference>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    private readonly emailService: EmailService,
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
    let notification: Notification;
    try {
      notification = await this.notificationsRepository.save(
        this.notificationsRepository.create({ ...input, recipientUserIds: recipients }),
      );
    } catch (error) {
      // Two scheduler instances may race. The unique dedupe key makes the
      // persisted notification single-instance while allowing the losing
      // attempt to retry delivery of the already-persisted record.
      if (!(error instanceof QueryFailedError) || !input.dedupeKey) throw error;
      const existing = await this.notificationsRepository.findOne({
        where: { dedupeKey: input.dedupeKey },
      });
      if (!existing) throw error;
      notification = existing;
    }
    void this.dispatchExternalChannels(notification, recipients).catch((error: Error) =>
      this.logger.error(`External channel dispatch failed for notification ${notification.id}: ${error.message}`),
    );
    return notification;
  }

  /**
  * Resolves recipients by position slug: superadmins plus users whose
  * active employee position matches one of the requested positions.
   */
  async getUserIdsByPosition(outletId: number, positionSlugs: string[]): Promise<number[]> {
    if (positionSlugs.length === 0) return this.presentUserIds(outletId, true);
    const [presentSuperadmins, assigned] = await Promise.all([
      this.presentUserIds(outletId, true),
      this.resolveAssignedEmployeeUserIds(outletId, { positionSlugs }),
    ]);
    return [...new Set([...presentSuperadmins, ...assigned])];
  }

  /**
   * Present staff must have an active outlet assignment. They also need an
   * open attendance record, but only for tenants that have turned on the
   * attendance-required toggle (`tenants.attendance_required`) — otherwise
   * staff never clock in at all and this would resolve to zero recipients,
   * silently dropping every notification (in-app and push) for that tenant.
   */
  async getActiveStaffUserIds(outletId?: number): Promise<number[]> {
    if (!outletId) return [];
    const [presentSuperadmins, assigned] = await Promise.all([
      this.presentUserIds(outletId, true),
      this.resolveAssignedEmployeeUserIds(outletId),
    ]);
    return [...new Set([...presentSuperadmins, ...assigned])];
  }

  /** Active employees assigned to the outlet, optionally narrowed by position slug and gated by attendance when the tenant requires it. */
  private async resolveAssignedEmployeeUserIds(
    outletId: number,
    options: { positionSlugs?: string[] } = {},
  ): Promise<number[]> {
    const attendanceRequired = await this.isAttendanceRequired(outletId);
    const qb = this.notificationsRepository.manager
      .createQueryBuilder()
      .from('employees', 'employee')
      .innerJoin('positions', 'position', 'position.id = employee.position_id')
      .innerJoin('employee_outlet_assignments', 'assignment', 'assignment.employee_id = employee.id')
      .where('assignment.outlet_id = :outletId', { outletId })
      .andWhere('assignment.is_active = true')
      .andWhere('employee.is_active = true')
      .andWhere("employee.employment_status = 'active'")
      .andWhere('position.is_active = true')
      .select('employee.user_id', 'userId');
    if (options.positionSlugs) {
      qb.andWhere('position.slug IN (:...positionSlugs)', { positionSlugs: options.positionSlugs });
    }
    if (attendanceRequired) {
      qb.innerJoin(
        Attendance,
        'attendance',
        'attendance.employee_id = employee.user_id AND attendance.outlet_id = assignment.outlet_id',
      )
        .andWhere('attendance.clock_out IS NULL')
        .andWhere("attendance.status IN ('present', 'late')");
    }
    const rows = await qb.getRawMany<{ userId: string }>();
    return rows.map((row) => Number(row.userId));
  }

  private async isAttendanceRequired(outletId: number): Promise<boolean> {
    const [row] = await this.notificationsRepository.manager.query(
      `SELECT t.attendance_required AS "attendanceRequired"
       FROM outlets o JOIN tenants t ON t.id = o.tenant_id
       WHERE o.id = $1`,
      [outletId],
    ) as Array<{ attendanceRequired: boolean }>;
    return row?.attendanceRequired ?? false;
  }

  private async presentUserIds(outletId: number, superadminsOnly = false): Promise<number[]> {
    const qb = this.attendanceRepository
      .createQueryBuilder('attendance')
      .innerJoin(User, 'user', 'user.id = attendance.employee_id')
      .where('attendance.outlet_id = :outletId', { outletId })
      .andWhere('attendance.clock_out IS NULL')
      .andWhere("attendance.status IN ('present', 'late')");
    if (superadminsOnly) qb.andWhere('user.is_superadmin = true');
    const rows = await qb.select('attendance.employee_id', 'userId').getRawMany<{ userId: string }>();
    return rows.map((row) => Number(row.userId));
  }

  /** Creates a notification for only active holders of the requested positions. */
  async createForPositions(
    outletId: number,
    positionSlugs: string[],
    input: Partial<Notification>,
  ): Promise<Notification> {
    const recipientUserIds = await this.getUserIdsByPosition(outletId, positionSlugs);
    if (recipientUserIds.length === 0) {
      const issue = await this.notificationIssuesRepository.save(
        this.notificationIssuesRepository.create({
          outletId,
          notificationType: input.type ?? 'system',
          title: 'Notification has no eligible recipient',
          reason: `No eligible user matched the configured recipient positions: ${positionSlugs.join(', ') || '(none)'}`,
          policyVersionId: null,
          notificationId: null,
          status: 'unresolved',
          metadata: { positionSlugs, input },
        }),
      );
      const superadminIds = await this.getAllSuperadminIds();
      if (superadminIds.length > 0) {
        const issueNotification = await this.create(
          {
            outletId,
            type: 'system',
            title: `Notification delivery issue #${issue.id}`,
            body: `No eligible recipient for ${input.type ?? 'notification'} at outlet ${outletId}. ${issue.reason}`,
            priority: 'urgent',
            data: JSON.stringify({ issueId: issue.id, notificationType: input.type ?? 'system' }),
            dedupeKey: `notification-issue:${issue.id}`,
          },
          superadminIds,
        );
        await this.notificationIssuesRepository.update(issue.id, {
          notificationId: issueNotification.id,
        });
      }
    }
    return this.create({ ...input, outletId }, recipientUserIds);
  }

  private async getAllSuperadminIds(): Promise<number[]> {
    const users = await this.usersRepository.find({
      where: { isSuperadmin: true },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  /**
  * Fans a notification out to email/push for every active employee on the
  * notification's outlet (or, if `recipientUserIds` is
   * given, only those users), filtered by their preferences. In-app (feed +
   * websocket) delivery is unaffected by this — it always happens regardless
   * of these preferences (see the callers of `create`).
   */
  private async dispatchExternalChannels(
    notification: Notification,
    recipientUserIds?: number[],
  ): Promise<void> {
    if (!this.emailService.isConfigured && !this.pushService.isConfigured) {
      return;
    }

    let userIds: number[];
    if (recipientUserIds) {
      userIds = recipientUserIds;
    } else {
      userIds = await this.getActiveStaffUserIds(notification.outletId ?? undefined);
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
        if (preference.pushEnabled) {
          await this.pushService.sendToUser(user.id, notification.title, body, {
            type: notification.type,
            orderId: notification.orderId,
          }, notification.priority);
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
