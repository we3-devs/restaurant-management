import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { OutletsService } from '../outlets/outlets.service';
import { ListCustomerCreditAccountsQueryDto } from './dto/list-customer-credit-accounts-query.dto';
import { ListCustomerCreditTransactionsQueryDto } from './dto/list-customer-credit-transactions-query.dto';
import { CustomerCreditAccount } from './entities/customer-credit-account.entity';
import {
  CustomerCreditTransaction,
  CustomerCreditTransactionType,
} from './entities/customer-credit-transaction.entity';

interface WriteTransactionInput {
  customerId: number;
  orderId?: number;
  userId?: number;
  type: CustomerCreditTransactionType;
  amount: number;
  notes?: string;
}

@Injectable()
export class CustomerCreditService {
  constructor(
    @InjectRepository(CustomerCreditAccount)
    private readonly accountsRepository: Repository<CustomerCreditAccount>,
    @InjectRepository(CustomerCreditTransaction)
    private readonly transactionsRepository: Repository<CustomerCreditTransaction>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly outletsService: OutletsService,
    private readonly gateway: KitchenTicketsGateway,
  ) {}

  async getOrCreateAccount(
    customerId: number,
    manager?: EntityManager,
  ): Promise<CustomerCreditAccount> {
    const repo = manager
      ? manager.getRepository(CustomerCreditAccount)
      : this.accountsRepository;
    const existing = await repo.findOne({ where: { customerId } });
    if (existing) return existing;
    return repo.save(repo.create({ customerId }));
  }

  /**
   * The one place any customer_credit_accounts.outstanding_balance /
   * customer_credit_transactions row is ever mutated — every public
   * charge/settle/adjust method funnels through here inside its own
   * transaction. Mirrors LoyaltyService.writeTransaction.
   */
  private async writeTransaction(
    manager: EntityManager,
    input: WriteTransactionInput,
  ): Promise<CustomerCreditTransaction> {
    const accountRepo = manager.getRepository(CustomerCreditAccount);
    const transactionRepo = manager.getRepository(CustomerCreditTransaction);

    const account = await this.getOrCreateAccount(input.customerId, manager);
    const newBalance = account.outstandingBalance + input.amount;
    if (newBalance < 0) {
      throw new BadRequestException(
        `Settlement amount exceeds customer ${input.customerId}'s outstanding balance`,
      );
    }

    account.outstandingBalance = newBalance;
    if (input.type === 'charge') {
      account.lifetimeCharged += input.amount;
    } else if (input.type === 'settlement') {
      account.lifetimeSettled += Math.abs(input.amount);
    }
    await accountRepo.save(account);

    return transactionRepo.save(
      transactionRepo.create({
        customerId: input.customerId,
        orderId: input.orderId ?? null,
        userId: input.userId ?? null,
        type: input.type,
        amount: input.amount,
        balanceAfter: newBalance,
        notes: input.notes ?? null,
      }),
    );
  }

  private async notifyOverLimit(account: CustomerCreditAccount): Promise<void> {
    if (!(account.creditLimit > 0 && account.outstandingBalance > account.creditLimit)) {
      return;
    }
    const outlets = await this.outletsService.findAll({ page: 1, limit: 1 });
    const outletId = outlets.data[0]?.id;
    if (outletId === undefined) return;
    const notification = await this.notificationsService.create({
      outletId,
      type: 'customer_credit_limit_exceeded',
      title: 'Customer credit limit exceeded',
      body: `Customer ${account.customerId} owes ${account.outstandingBalance}, above the credit limit of ${account.creditLimit}`,
      data: JSON.stringify({
        customerId: account.customerId,
        outstandingBalance: account.outstandingBalance,
        creditLimit: account.creditLimit,
      }),
    });
    this.gateway.notifyNotificationCreated(notification);
  }

  /** Order checked out with method="credit" — adds the order total to the customer's tab. */
  async chargeCredit(
    customerId: number,
    amount: number,
    opts: { orderId?: number; userId?: number; notes?: string } = {},
  ): Promise<CustomerCreditTransaction> {
    if (amount <= 0) {
      throw new BadRequestException('Charge amount must be positive');
    }
    const transaction = await this.dataSource.transaction((manager) =>
      this.writeTransaction(manager, {
        customerId,
        orderId: opts.orderId,
        userId: opts.userId,
        type: 'charge',
        amount,
        notes: opts.notes,
      }),
    );

    const account = await this.getOrCreateAccount(customerId);
    await this.notifyOverLimit(account);

    return transaction;
  }

  /** Customer pays down some or all of their outstanding balance, independent of any single order. */
  async settleDebt(
    customerId: number,
    amount: number,
    userId: number,
    notes?: string,
  ): Promise<CustomerCreditTransaction> {
    if (amount <= 0) {
      throw new BadRequestException('Settlement amount must be positive');
    }
    const account = await this.getOrCreateAccount(customerId);
    if (account.outstandingBalance <= 0) {
      throw new BadRequestException(
        `Customer ${customerId} has no outstanding balance to settle`,
      );
    }
    if (amount > account.outstandingBalance) {
      throw new BadRequestException(
        `Settlement amount (${amount}) exceeds the outstanding balance (${account.outstandingBalance})`,
      );
    }

    return this.dataSource.transaction((manager) =>
      this.writeTransaction(manager, {
        customerId,
        userId,
        type: 'settlement',
        amount: -amount,
        notes,
      }),
    );
  }

  async adjustBalance(
    customerId: number,
    delta: number,
    userId: number,
    notes?: string,
  ): Promise<CustomerCreditTransaction> {
    const transaction = await this.dataSource.transaction((manager) =>
      this.writeTransaction(manager, {
        customerId,
        userId,
        type: 'adjustment',
        amount: delta,
        notes,
      }),
    );

    if (delta > 0) {
      const account = await this.getOrCreateAccount(customerId);
      await this.notifyOverLimit(account);
    }

    return transaction;
  }

  async setCreditLimit(
    customerId: number,
    creditLimit: number,
  ): Promise<CustomerCreditAccount> {
    const account = await this.getOrCreateAccount(customerId);
    account.creditLimit = creditLimit;
    return this.accountsRepository.save(account);
  }

  /**
   * On order refund/cancellation: reverses the 'charge' transaction recorded
   * against the order (if any) with an offsetting refund_reversal entry.
   * No-op if the order was never charged to a customer's tab.
   */
  async reverseForRefund(orderId: number, userId: number | null): Promise<void> {
    const charge = await this.transactionsRepository.findOne({
      where: { orderId, type: 'charge' },
    });
    if (!charge) return;

    await this.dataSource.transaction((manager) =>
      this.writeTransaction(manager, {
        customerId: charge.customerId,
        orderId,
        userId: userId ?? undefined,
        type: 'refund_reversal',
        amount: -charge.amount,
      }),
    );
  }

  async findAccounts(
    query: ListCustomerCreditAccountsQueryDto,
  ): Promise<PaginatedResponse<CustomerCreditAccount & { customerName?: string }>> {
    const { page, limit, search } = query;
    const qb = this.accountsRepository
      .createQueryBuilder('account')
      .leftJoin('customers', 'customer', 'customer.id = account.customer_id')
      .addSelect(['customer.name AS "customerName"', 'customer.phone AS "customerPhone"'])
      .orderBy('account.outstanding_balance', 'DESC');

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

  async getAccountByCustomer(customerId: number): Promise<CustomerCreditAccount> {
    return this.getOrCreateAccount(customerId);
  }

  /** Active suppliers currently owing more than their credit limit — mirrors SuppliersService.findOverCreditLimit. */
  async findOverCreditLimit(): Promise<CustomerCreditAccount[]> {
    return this.accountsRepository
      .createQueryBuilder('account')
      .where('account.credit_limit > 0')
      .andWhere('account.outstanding_balance > account.credit_limit')
      .getMany();
  }

  async findTransactions(
    query: ListCustomerCreditTransactionsQueryDto,
  ): Promise<PaginatedResponse<CustomerCreditTransaction>> {
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
}
