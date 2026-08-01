import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { OutletsService } from '../outlets/outlets.service';
import { SettingsService } from '../settings/settings.service';
import { ListLoyaltyAccountsQueryDto } from './dto/list-loyalty-accounts-query.dto';
import { ListLoyaltyTransactionsQueryDto } from './dto/list-loyalty-transactions-query.dto';
import { LoyaltyAccount } from './entities/loyalty-account.entity';
import {
  LoyaltyTransaction,
  LoyaltyTransactionType,
} from './entities/loyalty-transaction.entity';

/** Lookahead window used to (re)compute each account's expiringPoints snapshot. */
const EXPIRING_SOON_WINDOW_DAYS = 30;

interface WriteTransactionInput {
  customerId: number;
  orderId?: number;
  userId?: number;
  type: LoyaltyTransactionType;
  points: number;
  source?: string;
  notes?: string;
  expiresAt?: Date;
}

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyAccount)
    private readonly accountsRepository: Repository<LoyaltyAccount>,
    @InjectRepository(LoyaltyTransaction)
    private readonly transactionsRepository: Repository<LoyaltyTransaction>,
    private readonly dataSource: DataSource,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly outletsService: OutletsService,
    private readonly gateway: KitchenTicketsGateway,
  ) {}

  async getOrCreateAccount(
    customerId: number,
    manager?: EntityManager,
  ): Promise<LoyaltyAccount> {
    const repo = manager
      ? manager.getRepository(LoyaltyAccount)
      : this.accountsRepository;
    const existing = await repo.findOne({ where: { customerId } });
    if (existing) return existing;
    return repo.save(repo.create({ customerId }));
  }

  /**
   * The one place any loyalty_accounts.current_points / loyalty_transactions
   * row is ever mutated — every public earn/redeem/adjust/reverse/expire
   * method funnels through here inside its own transaction.
   */
  private async writeTransaction(
    manager: EntityManager,
    input: WriteTransactionInput,
  ): Promise<LoyaltyTransaction> {
    const accountRepo = manager.getRepository(LoyaltyAccount);
    const transactionRepo = manager.getRepository(LoyaltyTransaction);

    const account = await this.getOrCreateAccount(input.customerId, manager);
    const newBalance = account.currentPoints + input.points;
    if (newBalance < 0) {
      throw new BadRequestException(
        `Insufficient loyalty points balance for customer ${input.customerId}`,
      );
    }

    account.currentPoints = newBalance;
    if (input.points > 0) {
      account.lifetimeEarned += input.points;
    } else if (input.type === 'redeem') {
      account.lifetimeRedeemed += Math.abs(input.points);
    }
    await accountRepo.save(account);

    return transactionRepo.save(
      transactionRepo.create({
        customerId: input.customerId,
        orderId: input.orderId ?? null,
        userId: input.userId ?? null,
        type: input.type,
        points: input.points,
        balanceAfter: newBalance,
        source: input.source ?? null,
        notes: input.notes ?? null,
        expiresAt: input.expiresAt ?? null,
      }),
    );
  }

  private async notify(
    type: 'loyalty_points_earned' | 'loyalty_points_redeemed',
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const outlets = await this.outletsService.findAll({ page: 1, limit: 1 });
    const outletId = outlets.data[0]?.id;
    if (outletId === undefined) return;
    const notification = await this.notificationsService.create({
      outletId,
      type,
      title,
      body,
      data: JSON.stringify(data),
    });
    this.gateway.notifyNotificationCreated(notification);
  }

  async earnPoints(
    customerId: number,
    points: number,
    source: string,
    opts?: { orderId?: number; userId?: number; notes?: string },
  ): Promise<LoyaltyTransaction> {
    const loyaltySettings = await this.settingsService.getLoyaltySettings();
    const expiryDays = Number(loyaltySettings.pointExpiryDays ?? 0);
    const expiresAt =
      expiryDays > 0
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60_000)
        : undefined;

    const transaction = await this.dataSource.transaction((manager) =>
      this.writeTransaction(manager, {
        customerId,
        orderId: opts?.orderId,
        userId: opts?.userId,
        type: 'earn',
        points,
        source,
        notes: opts?.notes,
        expiresAt,
      }),
    );

    await this.notify(
      'loyalty_points_earned',
      'Loyalty points earned',
      `Customer ${customerId} earned ${points} points (${source})`,
      { customerId, points, source, orderId: opts?.orderId },
    );

    return transaction;
  }

  /**
   * Validates the account-level minimum/available-balance rules. The
   * max-redemption-percent-of-order-total cap is enforced by the caller
   * (OrdersService.redeemLoyaltyPoints) since only it knows the order's
   * grand total.
   */
  async redeemPoints(
    customerId: number,
    points: number,
    orderId: number,
    userId: number,
  ): Promise<LoyaltyTransaction> {
    if (points <= 0) {
      throw new BadRequestException('Points to redeem must be positive');
    }
    const loyaltySettings = await this.settingsService.getLoyaltySettings();
    const minRedemptionPoints = Number(loyaltySettings.minRedemptionPoints ?? 0);
    if (points < minRedemptionPoints) {
      throw new BadRequestException(
        `A minimum of ${minRedemptionPoints} points is required to redeem`,
      );
    }

    const account = await this.getOrCreateAccount(customerId);
    if (account.currentPoints < points) {
      throw new BadRequestException(
        `Customer ${customerId} only has ${account.currentPoints} points available`,
      );
    }

    const transaction = await this.dataSource.transaction((manager) =>
      this.writeTransaction(manager, {
        customerId,
        orderId,
        userId,
        type: 'redeem',
        points: -points,
        source: 'order_redemption',
      }),
    );

    await this.notify(
      'loyalty_points_redeemed',
      'Loyalty points redeemed',
      `Customer ${customerId} redeemed ${points} points on order ${orderId}`,
      { customerId, points, orderId },
    );

    return transaction;
  }

  async adjustPoints(
    customerId: number,
    delta: number,
    userId: number,
    notes?: string,
  ): Promise<LoyaltyTransaction> {
    return this.dataSource.transaction((manager) =>
      this.writeTransaction(manager, {
        customerId,
        userId,
        type: 'adjustment',
        points: delta,
        notes,
      }),
    );
  }

  /**
   * On order refund/cancellation: reverses every prior earn/redeem
   * transaction recorded against the order with an offsetting
   * refund_reversal entry. No-op if nothing was ever recorded for it.
   */
  async reverseForRefund(orderId: number, userId: number): Promise<void> {
    const priorTransactions = await this.transactionsRepository.find({
      where: [
        { orderId, type: 'earn' },
        { orderId, type: 'redeem' },
      ],
    });
    if (priorTransactions.length === 0) return;

    await this.dataSource.transaction(async (manager) => {
      for (const prior of priorTransactions) {
        await this.writeTransaction(manager, {
          customerId: prior.customerId,
          orderId,
          userId,
          type: 'refund_reversal',
          points: -prior.points,
          source: 'refund_reversal',
        });
      }
    });
  }

  async findAccounts(
    query: ListLoyaltyAccountsQueryDto,
  ): Promise<PaginatedResponse<LoyaltyAccount & { customerName?: string }>> {
    const { page, limit, search } = query;
    const qb = this.accountsRepository
      .createQueryBuilder('account')
      .leftJoin('customers', 'customer', 'customer.id = account.customer_id')
      .addSelect(['customer.name AS "customerName"', 'customer.phone AS "customerPhone"'])
      .orderBy('account.current_points', 'DESC');

    if (search) {
      qb.andWhere(
        '(customer.name ILIKE :search OR customer.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();
    const rows = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawAndEntities();

    const data = rows.entities.map((entity, index) => ({
      ...entity,
      customerName: rows.raw[index]?.customerName as string | undefined,
    }));

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getAccountByCustomer(customerId: number): Promise<LoyaltyAccount> {
    return this.getOrCreateAccount(customerId);
  }

  async findTransactions(
    query: ListLoyaltyTransactionsQueryDto,
  ): Promise<PaginatedResponse<LoyaltyTransaction>> {
    const { page, limit, customerId, type, dateFrom, dateTo } = query;
    const qb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .orderBy('transaction.created_at', 'DESC');

    if (customerId !== undefined) {
      qb.andWhere('transaction.customer_id = :customerId', { customerId });
    }
    if (type) {
      qb.andWhere('transaction.type = :type', { type });
    }
    if (dateFrom) {
      qb.andWhere('transaction.created_at >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('transaction.created_at <= :dateTo', { dateTo });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Expires points whose backing 'earn' transactions have passed
   * expires_at. For each affected account: sums the still-unexpired,
   * past-due earn transactions, writes one offsetting 'expiry' transaction
   * capped at the account's current balance, and marks those earn rows
   * is_expired. Then recomputes every account's expiringPoints snapshot
   * (sum of non-expired earn points due within EXPIRING_SOON_WINDOW_DAYS).
   */
  async expirePoints(): Promise<{ processed: number }> {
    const now = new Date();
    const dueEarns = await this.transactionsRepository
      .createQueryBuilder('t')
      .where("t.type = 'earn'")
      .andWhere('t.is_expired = false')
      .andWhere('t.expires_at IS NOT NULL')
      .andWhere('t.expires_at <= :now', { now })
      .getMany();

    const byCustomer = new Map<number, LoyaltyTransaction[]>();
    for (const t of dueEarns) {
      const group = byCustomer.get(t.customerId);
      if (group) group.push(t);
      else byCustomer.set(t.customerId, [t]);
    }

    let processed = 0;
    for (const [customerId, earns] of byCustomer) {
      const sumExpiring = earns.reduce((sum, t) => sum + t.points, 0);
      await this.dataSource.transaction(async (manager) => {
        const account = await this.getOrCreateAccount(customerId, manager);
        const expireAmount = Math.min(sumExpiring, account.currentPoints);
        if (expireAmount > 0) {
          await this.writeTransaction(manager, {
            customerId,
            type: 'expiry',
            points: -expireAmount,
            source: 'point_expiry',
          });
        }
        const earnRepo = manager.getRepository(LoyaltyTransaction);
        for (const t of earns) {
          t.isExpired = true;
          await earnRepo.save(t);
        }
      });
      processed += 1;
    }

    await this.recomputeExpiringPoints();
    return { processed };
  }

  private async recomputeExpiringPoints(): Promise<void> {
    const soon = new Date(
      Date.now() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60_000,
    );
    const rows = await this.transactionsRepository
      .createQueryBuilder('t')
      .select('t.customer_id', 'customerId')
      .addSelect('COALESCE(SUM(t.points), 0)', 'expiringPoints')
      .where("t.type = 'earn'")
      .andWhere('t.is_expired = false')
      .andWhere('t.expires_at IS NOT NULL')
      .andWhere('t.expires_at <= :soon', { soon })
      .groupBy('t.customer_id')
      .getRawMany<{ customerId: string; expiringPoints: string }>();

    const expiringByCustomer = new Map(
      rows.map((row) => [Number(row.customerId), Number(row.expiringPoints)]),
    );

    const accounts = await this.accountsRepository.find();
    for (const account of accounts) {
      const expiringPoints = expiringByCustomer.get(account.customerId) ?? 0;
      if (account.expiringPoints !== expiringPoints) {
        account.expiringPoints = expiringPoints;
        await this.accountsRepository.save(account);
      }
    }
  }

  /**
   * Grants each birthday-matching customer their birthday bonus once per
   * day, guarded against double-granting via an existing same-day
   * 'birthday_bonus' earn transaction check.
   */
  async grantBirthdayBonuses(): Promise<{ granted: number }> {
    const loyaltySettings = await this.settingsService.getLoyaltySettings();
    const birthdayBonusPoints = Number(loyaltySettings.birthdayBonusPoints ?? 0);
    if (birthdayBonusPoints <= 0) return { granted: 0 };

    const customers = await this.transactionsRepository.manager.query<
      { id: string }[]
    >(`
      SELECT id FROM customers
      WHERE date_of_birth IS NOT NULL
        AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
        AND deleted_at IS NULL
    `);

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    let granted = 0;
    for (const row of customers) {
      const customerId = Number(row.id);
      const alreadyGranted = await this.transactionsRepository.findOne({
        where: {
          customerId,
          type: 'earn',
          source: 'birthday_bonus',
        },
      });
      if (alreadyGranted && alreadyGranted.createdAt >= todayMidnight) {
        continue;
      }
      await this.earnPoints(customerId, birthdayBonusPoints, 'birthday_bonus');
      granted += 1;
    }

    return { granted };
  }
}
