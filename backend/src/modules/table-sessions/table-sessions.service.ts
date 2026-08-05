import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { CustomersService } from '../customers/customers.service';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { DiningTable } from '../dining-tables/entities/dining-table.entity';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { LoyaltyAccount } from '../loyalty/entities/loyalty-account.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { OutletsService } from '../outlets/outlets.service';
import { ReservationsService } from '../reservations/reservations.service';
import { CreateTableSessionDto } from './dto/create-table-session.dto';
import { ListTableSessionsQueryDto } from './dto/list-table-sessions-query.dto';
import { TransferTableSessionDto } from './dto/transfer-table-session.dto';
import { TableSession } from './entities/table-session.entity';

const OPEN_SESSION_STATUSES: TableSession['status'][] = ['active', 'billing'];

export interface TableSessionCustomerSummary {
  id: number;
  name: string;
  phone: string | null;
  loyaltyTier: string | null;
}

export type TableSessionWithCustomer = Omit<TableSession, 'customer'> & {
  customer: TableSessionCustomerSummary | null;
};

export type TableSessionDetail = TableSessionWithCustomer & {
  outletName: string;
  diningTableName: string;
};

/**
 * Columns POS/floor board list rows actually use. `relations: ['customer']`
 * without this pulls the customer's jsonb blobs (addresses, allergies,
 * dietaryPreferences, favoriteFoodIds) on every row just to read a name and
 * phone number.
 */
const LIST_SELECT = {
  id: true,
  outletId: true,
  diningTableId: true,
  reservationId: true,
  customerId: true,
  guestCount: true,
  source: true,
  status: true,
  startedAt: true,
  billingStartedAt: true,
  endedAt: true,
  startedBy: true,
  endedBy: true,
  transferredBy: true,
  transferredAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { id: true, name: true, phone: true },
} as const;

@Injectable()
export class TableSessionsService {
  private readonly logger = new Logger(TableSessionsService.name);

  constructor(
    @InjectRepository(TableSession)
    private readonly tableSessionsRepository: Repository<TableSession>,
    @InjectRepository(LoyaltyAccount)
    private readonly loyaltyAccountsRepository: Repository<LoyaltyAccount>,
    private readonly diningTablesService: DiningTablesService,
    private readonly outletsService: OutletsService,
    private readonly customersService: CustomersService,
    @Inject(forwardRef(() => ReservationsService))
    private readonly reservationsService: ReservationsService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: ListTableSessionsQueryDto,
  ): Promise<PaginatedResponse<TableSessionWithCustomer>> {
    const methodStart = Date.now();
    const { page, limit, outletId, diningTableId, status } = query;
    const where: FindOptionsWhere<TableSession> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    }
    if (diningTableId !== undefined) {
      where.diningTableId = diningTableId;
    }
    if (status !== undefined) {
      where.status = status;
    }

    const queryStart = Date.now();
    const [sessions, total] = await this.tableSessionsRepository.findAndCount({
      where,
      relations: ['customer'],
      select: LIST_SELECT,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const queryMs = Date.now() - queryStart;

    const data = await this.attachCustomerSummaries(sessions);
    this.logger.debug(
      `findAll query=${queryMs}ms total=${Date.now() - methodStart}ms rows=${sessions.length}`,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Trims each session's loaded `customer` relation down to what a floor
   * board should show (name/phone/loyalty tier, not addresses/allergies/etc)
   * and merges in loyalty tier with one batched query for the whole page —
   * not one query per session.
   */
  private async attachCustomerSummaries(
    sessions: TableSession[],
  ): Promise<TableSessionWithCustomer[]> {
    const customerIds = [
      ...new Set(
        sessions
          .map((session) => session.customer?.id)
          .filter((id): id is number => id !== undefined),
      ),
    ];
    const loyaltyAccounts = customerIds.length
      ? await this.loyaltyAccountsRepository.find({
          where: { customerId: In(customerIds) },
        })
      : [];
    const tierByCustomerId = new Map(
      loyaltyAccounts.map((account) => [account.customerId, account.tier]),
    );

    return sessions.map((session) => ({
      ...session,
      customer: session.customer
        ? {
            id: session.customer.id,
            name: session.customer.name,
            phone: session.customer.phone,
            loyaltyTier: tierByCustomerId.get(session.customer.id) ?? null,
          }
        : null,
    }));
  }

  /** Internal lookup used by OrdersService to validate a tableSessionId. */
  async findOne(id: number): Promise<TableSession> {
    const session = await this.tableSessionsRepository.findOne({
      where: { id },
    });
    if (!session) {
      throw new NotFoundException(`Table session ${id} not found`);
    }
    return session;
  }

  /** GET /table-sessions/:id — the guest/outlet/table names a detail page actually needs, not just the raw ids findOne() gives internal callers. */
  async findOneDetailed(id: number): Promise<TableSessionDetail> {
    const methodStart = Date.now();
    const session = await this.tableSessionsRepository.findOne({
      where: { id },
      relations: ['customer', 'diningTable', 'outlet'],
      select: {
        ...LIST_SELECT,
        diningTable: { id: true, name: true },
        outlet: { id: true, name: true },
      },
    });
    if (!session) {
      throw new NotFoundException(`Table session ${id} not found`);
    }

    const [withCustomer] = await this.attachCustomerSummaries([session]);
    this.logger.debug(
      `findOneDetailed(${id}) total=${Date.now() - methodStart}ms`,
    );
    return {
      ...withCustomer,
      outletName: session.outlet.name,
      diningTableName: session.diningTable.name,
    };
  }

  /** The table's current active/billing session, if any — used to decide whether a guest order needs a new session opened first. */
  async findActiveForTable(diningTableId: number): Promise<TableSession | null> {
    return this.tableSessionsRepository.findOne({
      where: { diningTableId, status: In(OPEN_SESSION_STATUSES) },
    });
  }

  /** The table's most recent session regardless of status — used to scope a guest's "my orders" view to their own visit, not just their phone number's whole history at this table. */
  async findLatestForTable(diningTableId: number): Promise<TableSession | null> {
    return this.tableSessionsRepository.findOne({
      where: { diningTableId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Ties a verified guest to a session that's already open (e.g. a staff
   * walk-in with no customer on record yet, or a second guest joining the
   * same table). Never overwrites a customerId that's already set — the
   * session keeps its original customer of record.
   */
  async attachCustomerIfMissing(
    id: number,
    customerId: number,
  ): Promise<TableSession> {
    const session = await this.findOne(id);
    if (session.customerId !== null) {
      return session;
    }
    session.customerId = customerId;
    const saved = await this.tableSessionsRepository.save(session);
    // First time this session gets a customer of record — counts as one
    // dine-in visit. The no-op guard above means this only ever fires once
    // per session, even if more guests place orders on it afterwards.
    await this.customersService.upsertVisit(customerId, session.outletId);
    return saved;
  }

  /**
   * Shared by every guest-facing entry point (place an order, call staff, ...):
   * reuses the table's open session if there is one (attaching the customer
   * if it doesn't have one yet), otherwise opens a fresh 'qr_order' session.
   * Guarantees a guest interacting with a table is always tied to a session,
   * and that session is always tied to a phone-verified customer.
   */
  async ensureActiveForGuest(
    diningTableId: number,
    outletId: number,
    customerId: number,
  ): Promise<TableSession> {
    const existing = await this.findActiveForTable(diningTableId);
    if (!existing) {
      return this.create(
        { outletId, diningTableId, source: 'qr_order', customerId },
        null,
      );
    }
    return this.attachCustomerIfMissing(existing.id, customerId);
  }

  /**
   * create()'s outlet/table/customer/reservation existence checks, split out
   * so a caller that embeds session creation inside a larger transaction
   * (see OrdersService#openTableWithOrder) can run the same validation up
   * front without duplicating it. They have no dependency on each other, so
   * they run as one round trip instead of up to four serialized ones.
   * `diningTable` is returned (not re-fetched later) purely to read its
   * `.name` for the notification in runPostCreateSideEffects().
   */
  async validateCreateInputs(dto: CreateTableSessionDto): Promise<DiningTable> {
    const [, diningTable] = await Promise.all([
      this.outletsService.findOne(dto.outletId),
      this.diningTablesService.findOne(dto.diningTableId),
      dto.customerId !== undefined
        ? this.customersService.findOne(dto.customerId)
        : Promise.resolve(null),
      dto.reservationId !== undefined
        ? this.reservationsService.findOne(dto.reservationId)
        : Promise.resolve(null),
    ]);
    return diningTable;
  }

  /**
   * The two statements of create() that must be atomic (the open-session
   * check and the insert), taking the manager as a parameter so a caller
   * can run this inside its *own* `dataSource.transaction()` alongside other
   * writes that need to commit together with it (see
   * OrdersService#openTableWithOrder, which inserts the session's first
   * order in the same transaction).
   */
  async insertSession(
    manager: EntityManager,
    dto: CreateTableSessionDto,
    startedBy: number | null,
  ): Promise<TableSession> {
    await this.assertNoOpenSession(dto.diningTableId, manager);

    const session = manager.create(TableSession, {
      outletId: dto.outletId,
      diningTableId: dto.diningTableId,
      guestCount: dto.guestCount ?? 1,
      source: dto.source ?? 'staff',
      customerId: dto.customerId ?? null,
      reservationId: dto.reservationId ?? null,
      status: 'active',
      startedAt: new Date(),
      startedBy,
    });
    return manager.save(session);
  }

  /**
   * Post-commit work for a session insertSession() just committed: three
   * independent writes (table status, customer visit stats, notification
   * row) — none reads another's result.
   *
   * By default they run concurrently (three pool connections at once),
   * because for TableSessionsService#create() this is awaited *before* the
   * response is sent — each is required for correctness the client can
   * observe immediately after (table status on the next floor-board fetch,
   * visit count on the next customer lookup, the notification row existing
   * before it's broadcast), so the extra concurrency is worth it there to
   * keep the response fast.
   *
   * `sequential: true` is for callers that already returned their response
   * and are running this fire-and-forget (see
   * OrdersService#openTableWithOrder): nothing is waiting on these writes
   * anymore, so there's no latency reason to hold 3 pool connections at
   * once — and doing so was racing the client's own post-response refetch
   * burst for the same limited PgBouncer session pool (see app.module.ts's
   * `max`/`min` comment), tipping it over the ceiling and surfacing as 500s
   * on unrelated concurrent requests. One connection at a time avoids that.
   *
   * The realtime push itself is always fire-and-forget — wrapped so a
   * broadcast failure logs instead of surfacing as a 500 for a session
   * that's already durably committed.
   */
  async runPostCreateSideEffects(
    dto: CreateTableSessionDto,
    saved: TableSession,
    diningTable: DiningTable,
    startedBy: number | null,
    options?: { sequential?: boolean },
  ): Promise<void> {
    const setStatus = () =>
      this.diningTablesService.setStatus(dto.diningTableId, 'occupied');
    const upsertVisit = () =>
      dto.customerId !== undefined
        ? // First time this session gets a customer of record — counts as
          // one dine-in visit (mirrors the guard in attachCustomerIfMissing()).
          // outletId was already validated above — skip upsertVisit's own check.
          this.customersService.upsertVisit(dto.customerId, dto.outletId, {
            skipOutletValidation: true,
          })
        : Promise.resolve(null);
    const createNotification = () =>
      this.notificationsService.create({
        outletId: dto.outletId,
        type: 'system',
        title: `${diningTable.name} — guests checked in`,
        body: `${saved.guestCount} guest(s)`,
        tableName: diningTable.name,
        actorUserId: startedBy,
        data: JSON.stringify({ tableSessionId: saved.id }),
      });

    let notification: Notification;
    if (options?.sequential) {
      await setStatus();
      await upsertVisit();
      notification = await createNotification();
    } else {
      [, , notification] = await Promise.all([
        setStatus(),
        upsertVisit(),
        createNotification(),
      ]);
    }

    try {
      this.gateway.notifyNotificationCreated(notification);
    } catch (error) {
      this.logger.error(
        `Failed to broadcast notification for table session ${saved.id}: ${(error as Error).message}`,
      );
    }
  }

  /** startedBy is null for guest-opened (source: 'qr_order') sessions — no staff member initiated it. */
  async create(
    dto: CreateTableSessionDto,
    startedBy: number | null,
  ): Promise<TableSession> {
    const requestStart = Date.now();

    const diningTable = await this.validateCreateInputs(dto);
    const saved = await this.dataSource.transaction((manager) =>
      this.insertSession(manager, dto, startedBy),
    );
    await this.runPostCreateSideEffects(dto, saved, diningTable, startedBy);

    this.logger.debug(
      `create(${saved.id}) total=${Date.now() - requestStart}ms`,
    );

    return saved;
  }

  async end(id: number, endedBy: number): Promise<TableSession> {
    const session = await this.findOne(id);
    session.status = 'completed';
    session.endedAt = new Date();
    session.endedBy = endedBy;
    const saved = await this.tableSessionsRepository.save(session);

    await this.diningTablesService.setStatus(
      session.diningTableId,
      'available',
    );

    const table = await this.diningTablesService.findOne(session.diningTableId);
    const notification = await this.notificationsService.create({
      outletId: session.outletId,
      type: 'system',
      title: `${table.name} — session ended`,
      tableName: table.name,
      actorUserId: endedBy,
      data: JSON.stringify({ tableSessionId: saved.id }),
    });
    this.gateway.notifyNotificationCreated(notification);

    return saved;
  }

  /** Moves an in-progress session to a different table (e.g. guests relocate before paying). */
  async transfer(
    id: number,
    dto: TransferTableSessionDto,
    transferredBy: number,
  ): Promise<TableSession> {
    const session = await this.findOne(id);

    if (!OPEN_SESSION_STATUSES.includes(session.status)) {
      throw new ConflictException(
        `Table session ${id} is not open (status: ${session.status})`,
      );
    }
    if (dto.newDiningTableId === session.diningTableId) {
      throw new ConflictException(
        `Table session ${id} is already on table ${dto.newDiningTableId}`,
      );
    }

    const newTable = await this.diningTablesService.findOne(
      dto.newDiningTableId,
    );
    if (newTable.outletId !== session.outletId) {
      throw new BadRequestException(
        `Dining table ${dto.newDiningTableId} does not belong to outlet ${session.outletId}`,
      );
    }

    const oldDiningTableId = session.diningTableId;

    const saved = await this.dataSource.transaction(async (manager) => {
      await this.assertNoOpenSession(dto.newDiningTableId, manager);

      session.diningTableId = dto.newDiningTableId;
      session.transferredBy = transferredBy;
      session.transferredAt = new Date();
      return manager.save(session);
    });

    await this.diningTablesService.setStatus(oldDiningTableId, 'available');
    await this.diningTablesService.setStatus(dto.newDiningTableId, 'occupied');

    return saved;
  }

  private async assertNoOpenSession(
    diningTableId: number,
    manager: EntityManager,
  ): Promise<void> {
    const existing = await manager.findOne(TableSession, {
      where: { diningTableId, status: In(OPEN_SESSION_STATUSES) },
    });
    if (existing) {
      throw new ConflictException(
        `Dining table ${diningTableId} already has an open session`,
      );
    }
  }
}
