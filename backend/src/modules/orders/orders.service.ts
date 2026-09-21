import { v4 as uuidv4 } from 'uuid';
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
  ILike,
  In,
  Between,
  Not,
  Repository,
} from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { AddonsService } from '../addons/addons.service';
import { CustomerCreditService } from '../customer-credit/customer-credit.service';
import { CustomersService } from '../customers/customers.service';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { CreateTableSessionDto } from '../table-sessions/dto/create-table-session.dto';
import { OpenTableSessionDto } from '../table-sessions/dto/open-table-session.dto';
import { TableSession } from '../table-sessions/entities/table-session.entity';
import { FoodVariantsService } from '../food-variants/food-variants.service';
import { Food } from '../foods/entities/food.entity';
import { FoodsService } from '../foods/foods.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { isTrackableIngredientType } from '../ingredient-categories/ingredient-category-type.util';
import { WarehouseIngredientStocksService } from '../inventory-stock/warehouse-ingredient-stocks.service';
import { KitchenTicketItem } from '../kitchen-tickets/entities/kitchen-ticket-item.entity';
import { KitchenTicket } from '../kitchen-tickets/entities/kitchen-ticket.entity';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { KitchenTicketsService } from '../kitchen-tickets/kitchen-tickets.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OutletDepartment } from '../outlet-departments/entities/outlet-department.entity';
import { OutletDepartmentsService } from '../outlet-departments/outlet-departments.service';
import { OutletsService } from '../outlets/outlets.service';
import {
  deriveOrderStageFromCounts,
  type NamedFoodStatusCount,
} from './order-stage';
import { OrderPayment } from '../order-payments/entities/order-payment.entity';
import { calculatePaymentTotals } from '@rms/validators/payment-totals';
import { ReservationsService } from '../reservations/reservations.service';
import { SettingsService } from '../settings/settings.service';
import { TableSessionsService } from '../table-sessions/table-sessions.service';
import { UnitsService } from '../units/units.service';
import { OperatingHoursService } from '../operating-hours/operating-hours.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateOrderItemAddonDto } from './dto/create-order-item-addon.dto';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrderItemsQueryDto } from './dto/list-order-items-query.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { WaiterOrderItemResponseDto } from './dto/waiter-order-item-response.dto';
import { OrderItemAddon } from './entities/order-item-addon.entity';
import { OrderItemIngredientReservation } from './entities/order-item-ingredient-reservation.entity';
import { OrderItem, type OrderItemPackagingType } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import type { OrderStatus } from './entities/order.entity';
import { TableSessionFoodStatusCount } from './entities/table-session-food-status-count.entity';

export interface OrderItemWithRelations extends OrderItem {
  addons: OrderItemAddon[];
  reservations: OrderItemIngredientReservation[];
}

export type OrderListResponse = Omit<Order, 'tableSession' | 'customer'> & {
  tableName: string | null;
  customerName: string | null;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Happy-path order lifecycle plus "cancelled" reachable from any
 * non-terminal state. `completed`/`cancelled` are terminal (no outgoing
 * edges) — enforced in updateStatus().
 *
 * `served` is additionally reachable directly from every non-terminal status
 * from `accepted` onward (not just `ready`/`partially_served`): nothing
 * proactively walks Order.status through `preparing`/`ready` as tickets
 * progress, so a kitchen that finishes fast (or an order with nothing to
 * track, see OrdersService#maybeAdvanceToServed) can legitimately jump
 * straight to `served` from wherever it's sitting.
 */
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'served', 'cancelled'],
  preparing: ['partially_ready', 'ready', 'served', 'cancelled'],
  partially_ready: ['ready', 'partially_served', 'served', 'cancelled'],
  ready: ['partially_served', 'served', 'cancelled'],
  partially_served: ['served', 'cancelled'],
  served: ['completed'],
  completed: [],
  cancelled: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(OrderItemAddon)
    private readonly orderItemAddonsRepository: Repository<OrderItemAddon>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoriesRepository: Repository<OrderStatusHistory>,
    @InjectRepository(OrderPayment)
    private readonly orderPaymentsRepository: Repository<OrderPayment>,
    @InjectRepository(OrderItemIngredientReservation)
    private readonly reservationsRepository: Repository<OrderItemIngredientReservation>,
    @InjectRepository(TableSessionFoodStatusCount)
    private readonly tableSessionFoodStatusCountsRepository: Repository<TableSessionFoodStatusCount>,
    @Inject(forwardRef(() => KitchenTicketsService))
    private readonly kitchenTicketsService: KitchenTicketsService,
    private readonly gateway: KitchenTicketsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly outletsService: OutletsService,
    private readonly tableSessionsService: TableSessionsService,
    private readonly customersService: CustomersService,
    private readonly reservationsService: ReservationsService,
    private readonly diningTablesService: DiningTablesService,
    private readonly foodsService: FoodsService,
    private readonly foodVariantsService: FoodVariantsService,
    private readonly addonsService: AddonsService,
    private readonly outletDepartmentsService: OutletDepartmentsService,
    private readonly ingredientsService: IngredientsService,
    private readonly unitsService: UnitsService,
    private readonly warehousesService: WarehousesService,
    private readonly warehouseIngredientStocksService: WarehouseIngredientStocksService,
    private readonly dataSource: DataSource,
    private readonly loyaltyService: LoyaltyService,
    private readonly settingsService: SettingsService,
    private readonly customerCreditService: CustomerCreditService,
    private readonly operatingHoursService: OperatingHoursService,
  ) {}

  // ---------------------------------------------------------------- orders

  /**
   * accessibleOutletIds narrows the result set to the caller's own outlets
   * — 'ALL' for superadmins/unscoped staff, otherwise the exact list from
   * OutletAccessService. Applied at the query level (not filtered after
   * fetch) so an unauthorized outlet's orders are never read off the DB in
   * the first place.
   */
  async findAll(
    query: ListOrdersQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<OrderListResponse>> {
    const { page, limit, search, outletId, tableSessionId, status, excludeStatus, createdFrom, createdTo } = query;
    const baseWhere: FindOptionsWhere<Order> = {};
    if (outletId !== undefined) {
      baseWhere.outletId = outletId;
    } else if (accessibleOutletIds !== 'ALL') {
      baseWhere.outletId = In(accessibleOutletIds);
    }
    if (tableSessionId !== undefined) {
      baseWhere.tableSessionId = tableSessionId;
    }
    if (status !== undefined) {
      baseWhere.status = status;
    } else if (excludeStatus?.length) {
      baseWhere.status = Not(In(excludeStatus));
    }
    if (createdFrom || createdTo) {
      baseWhere.createdAt = Between(
        createdFrom ? new Date(createdFrom) : new Date(0),
        createdTo ? new Date(createdTo) : new Date('9999-12-31T23:59:59.999Z'),
      );
    }
    const where: FindOptionsWhere<Order> | FindOptionsWhere<Order>[] = search
      ? [
          { ...baseWhere, orderNumber: ILike(`%${search}%`) },
          { ...baseWhere, customer: { name: ILike(`%${search}%`) } },
        ]
      : baseWhere;

    const [orders, total] = await this.ordersRepository.findAndCount({
      where,
      relations: { tableSession: { diningTable: true }, customer: true },
      select: {
        id: true,
        outletId: true,
        tableSessionId: true,
        customerId: true,
        orderNumber: true,
        orderType: true,
        source: true,
        orderSource: true,
        status: true,
        paymentStatus: true,
        approvalStatus: true,
        completedAt: true,
        cancelledAt: true,
        cancelReason: true,
        subtotal: true,
        discountType: true,
        discountValue: true,
        discountAmount: true,
        serviceChargeAmount: true,
        taxAmount: true,
        grandTotal: true,
        paidAmount: true,
        dueAmount: true,
        refundedAmount: true,
        createdAt: true,
        updatedAt: true,
        customer: { id: true, name: true },
        tableSession: { id: true, diningTable: { id: true, name: true } },
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: orders.map(({ tableSession, customer, ...order }) => ({
        ...order,
        tableName: tableSession?.diningTable?.name ?? null,
        customerName: customer?.name ?? null,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by OrderPaymentsService and by this service's own sub-resources. */
  async findOne(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  /** Every recorded status transition for an order, oldest first — written by updateStatus/reopenForNewItems, never previously read anywhere. */
  async listStatusHistory(orderId: number): Promise<OrderStatusHistory[]> {
    await this.findOne(orderId);
    return this.orderStatusHistoriesRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * The one deliberate exception to Order.status's forward-only rule (see
   * ORDER_STATUS_SEQUENCE / syncStatusFromItems): a new round of items just
   * landed on an order that had already reached 'served'/'partially_served'
   * (e.g. dessert ordered after mains were delivered) — without this, the
   * order would stay stuck showing "Served" while the kitchen quietly works
   * a brand new item, since syncStatusFromItems refuses to move status
   * backward. Bypasses updateStatus()'s transition-table check entirely
   * (it's not reachable through the normal graph); still logs the same
   * order_status_histories row a normal transition would.
   */
  private async reopenForNewItems(orderId: number, reason: string): Promise<void> {
    const order = await this.findOne(orderId);
    const fromStatus = order.status;
    if (fromStatus !== 'served' && fromStatus !== 'partially_served') return;

    order.status = 'accepted';
    await this.ordersRepository.save(order);
    await this.orderStatusHistoriesRepository.save(
      this.orderStatusHistoriesRepository.create({
        orderId,
        changedBy: null,
        fromStatus,
        toStatus: 'accepted',
        note: reason,
      }),
    );
  }

  /** Called by KitchenTicketsService after any item-level change — pushes the current order to the guest's own room if it's a guest order (no-op otherwise). */
  async notifyGuestByOrderId(orderId: number): Promise<void> {
    const order = await this.ordersRepository.findOne({ where: { id: orderId } });
    if (!order) return;
    this.gateway.notifyGuestOrderChanged(order);
  }

  /**
   * Shortest path from `from` to `to` over the real ORDER_STATUS_TRANSITIONS
   * graph (BFS — the graph is small and every edge weight is equal).
   * Deliberately not a fixed "walk every intermediate stage" list:
   * `partially_ready`/`ready` are alternatives at the same point in the
   * flow (as are `partially_served`/`served`), so e.g. preparing -> ready
   * must skip `partially_ready` entirely, not pass through it. Returns []
   * if `to` is unreachable from `from` (e.g. `to` is behind `from`).
   */
  private findStatusPath(from: OrderStatus, to: OrderStatus): OrderStatus[] {
    if (from === to) return [];
    const queue: OrderStatus[][] = [[from]];
    const visited = new Set<OrderStatus>([from]);
    while (queue.length > 0) {
      const path = queue.shift()!;
      const last = path[path.length - 1];
      for (const next of ORDER_STATUS_TRANSITIONS[last]) {
        if (next === to) return [...path.slice(1), next];
        if (!visited.has(next)) {
          visited.add(next);
          queue.push([...path, next]);
        }
      }
    }
    return [];
  }

  /**
   * Walks Order.status forward to wherever the order's kitchen counts say it
   * has actually reached. Called after any item-level change; Order.status
   * only otherwise moves on an explicit staff PATCH, so without this nothing
   * would carry it through preparing/partially-ready/ready as tickets
   * progress (see the ORDER_STATUS_TRANSITIONS comment).
   *
   * The target stage comes from table_session_food_status_counts via
   * deriveOrderStageFromCounts — the single derivation — rather than this
   * service re-aggregating order_items itself, which is what used to let
   * Order.status drift from the rollup. Safe to read the counts here because
   * the trigger that maintains them is row-level AFTER on order_items, so
   * every caller's item writes have already landed by the time this runs.
   *
   * Each hop goes through the normal updateStatus() path so history/
   * notifications/realtime push fire exactly as they would for a staff-driven
   * change, and only the direct hops the counts support are taken (via
   * findStatusPath). Deliberately never moves backward (e.g. after a recalled
   * item) — findStatusPath returns [] when `to` is behind `from`, since the
   * graph has no backward edges — and never touches cancelled/completed
   * orders or item status itself.
   */
  async syncStatusFromItems(
    orderId: number,
    changedBy: number | null,
  ): Promise<void> {
    const order = await this.findOne(orderId);
    if (order.status === 'cancelled' || order.status === 'completed') return;

    const counts = await this.tableSessionFoodStatusCountsRepository.find({
      where: { orderId },
    });
    const target = deriveOrderStageFromCounts(counts);
    if (!target) return;

    for (const status of this.findStatusPath(order.status, target)) {
      await this.updateStatus(orderId, { status }, changedBy);
    }
  }

  /**
   * A 'completed' order is a closed book — the last active status
   * (ORDER_STATUS_TRANSITIONS already blocks any further status change out
   * of it). Every other mutation surface (note/discount, items, addons,
   * table assignment, loyalty redemption, payments) needs the same wall,
   * called at each entry point rather than relying on any single choke
   * point since orders/order-items/order-payments are separate resources.
   */
  static assertMutable(order: Order): void {
    if (order.status === 'completed') {
      throw new ConflictException(
        `Order ${order.id} is completed and can no longer be modified`,
      );
    }
  }

  async create(dto: CreateOrderDto, createdBy: number): Promise<Order> {
    await this.operatingHoursService.assertOperational(dto.outletId);
    this.logger.log(`[ORDER_CREATE] Starting order creation: outletId=${dto.outletId}, orderType=${dto.orderType}`);
    try {
      await this.outletsService.findOne(dto.outletId);
      if (dto.tableSessionId !== undefined) {
        const session = await this.tableSessionsService.findOne(
          dto.tableSessionId,
        );
        if (session.outletId !== dto.outletId) {
          throw new BadRequestException(
            `Table session ${dto.tableSessionId} does not belong to outlet ${dto.outletId}`,
          );
        }
      }
      if (dto.customerId !== undefined) {
        await this.customersService.findOne(dto.customerId);
      }
      if (dto.reservationId !== undefined) {
        const reservation = await this.reservationsService.findOne(
          dto.reservationId,
        );
        if (reservation.outletId !== dto.outletId) {
          throw new BadRequestException(
            `Reservation ${dto.reservationId} does not belong to outlet ${dto.outletId}`,
          );
        }
      }

      this.logger.log(`[ORDER_CREATE] Validation passed, starting transaction for outletId=${dto.outletId}`);
      return await this.dataSource.transaction((manager) =>
        this.insertOrderWithBillNumber(manager, dto.outletId, (billId, billNumber) =>
          manager.create(Order, {
            outletId: dto.outletId,
            tableSessionId: dto.tableSessionId ?? null,
            customerId: dto.customerId ?? null,
            reservationId: dto.reservationId ?? null,
            orderType: dto.orderType ?? 'table',
            note: dto.note ?? null,
            orderNumber: this.generateOrderNumber(dto.outletId),
            billId,
            billNumber,
            createdBy,
          }),
        ),
      );
    } catch (error) {
      this.logger.error(`[ORDER_CREATE] Error creating order for outletId=${dto.outletId}: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * POST /table-sessions/open — opens a table session and inserts its first
   * order in one transaction (see TableSessionOpenController), then returns
   * immediately once that transaction commits. Every stage up to the commit
   * is timed separately and every SQL statement run against the
   * transaction's queryRunner is logged, purely to find out which stage of
   * a reported ~3s response is actually slow.
   *
   * Everything after the commit that isn't required to build the response
   * (table status, customer visit stats, notification + realtime broadcast)
   * runs as fire-and-forget background work via
   * TableSessionsService#runPostCreateSideEffects — the session/order are
   * already durably committed by that point, so a background failure there
   * must never change the response already sent to the client.
   */
  async openTableWithOrder(
    dto: OpenTableSessionDto,
    startedBy: number,
  ): Promise<{ session: TableSession; order: Order }> {
    await this.operatingHoursService.assertOperational(dto.outletId);
    const totalStart = process.hrtime.bigint();
    const stageMs: Record<string, number> = {};
    const sqlLog: { sql: string; ms: number }[] = [];
    const mark = (label: string, start: bigint) => {
      stageMs[label] = Number(process.hrtime.bigint() - start) / 1e6;
    };

    const sessionDto: CreateTableSessionDto = {
      outletId: dto.outletId,
      diningTableId: dto.diningTableId,
      guestCount: dto.guestCount,
      source: dto.source,
      customerId: dto.customerId,
      reservationId: dto.reservationId,
    };

    const validationStart = process.hrtime.bigint();
    const diningTable = await this.tableSessionsService.validateCreateInputs(
      sessionDto,
    );
    mark('validation', validationStart);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // Wrap the queryRunner's own query() — every save()/find()/count() call
    // made through queryRunner.manager funnels through this, so it captures
    // BEGIN/COMMIT/ROLLBACK plus every statement in between without
    // touching the global TypeORM logger (which would log every request,
    // not just this one).
    const originalQuery = queryRunner.query.bind(queryRunner);
    queryRunner.query = (async (...args: Parameters<typeof originalQuery>) => {
      const queryStart = process.hrtime.bigint();
      try {
        return await originalQuery(...args);
      } finally {
        sqlLog.push({
          sql: String(args[0]),
          ms: Number(process.hrtime.bigint() - queryStart) / 1e6,
        });
      }
    }) as typeof queryRunner.query;

    const beginStart = process.hrtime.bigint();
    await queryRunner.startTransaction();
    mark('beginTransaction', beginStart);

    let session: TableSession;
    let order: Order;
    try {
      const insertSessionStart = process.hrtime.bigint();
      session = await this.tableSessionsService.insertSession(
        queryRunner.manager,
        sessionDto,
        startedBy,
      );
      mark('insertSession', insertSessionStart);

      const insertOrderStart = process.hrtime.bigint();
      order = await this.insertOrderWithBillNumber(
        queryRunner.manager,
        dto.outletId,
        (billId, billNumber) =>
          queryRunner.manager.create(Order, {
            outletId: dto.outletId,
            tableSessionId: session.id,
            customerId: dto.customerId ?? null,
            reservationId: dto.reservationId ?? null,
            orderType: dto.orderType ?? 'table',
            note: dto.note ?? null,
            orderNumber: this.generateOrderNumber(dto.outletId),
            billId,
            billNumber,
            createdBy: startedBy,
          }),
      );
      mark('insertOrder', insertOrderStart);

      const commitStart = process.hrtime.bigint();
      await queryRunner.commitTransaction();
      mark('commit', commitStart);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const result = { session, order };

    const criticalPathMs = Number(process.hrtime.bigint() - totalStart) / 1e6;
    const stageLine = Object.entries(stageMs)
      .map(([label, ms]) => `${label}=${ms.toFixed(1)}ms`)
      .join(' ');
    this.logger.log(
      `openTableWithOrder(${session.id}) ${stageLine} criticalPathMs=${criticalPathMs.toFixed(1)}ms ` +
        `sqlStatements=${sqlLog.length} sequentialRoundTrips=${sqlLog.length}`,
    );
    sqlLog.forEach((q, i) => {
      this.logger.debug(
        `  [tx query ${i + 1}/${sqlLog.length}] ${q.ms.toFixed(1)}ms: ${q.sql}`,
      );
    });

    // Fire-and-forget: session/order are already committed, so nothing here
    // may change the response we're about to return. Failures are logged,
    // never thrown back into the request path.
    const backgroundStart = process.hrtime.bigint();
    this.tableSessionsService
      .runPostCreateSideEffects(sessionDto, session, diningTable, startedBy, {
        sequential: true,
      })
      .then(() => {
        const backgroundWorkMs =
          Number(process.hrtime.bigint() - backgroundStart) / 1e6;
        this.logger.log(
          `openTableWithOrder(${session.id}) backgroundWorkMs=${backgroundWorkMs.toFixed(1)}ms`,
        );
      })
      .catch((error) => {
        const backgroundWorkMs =
          Number(process.hrtime.bigint() - backgroundStart) / 1e6;
        this.logger.error(
          `openTableWithOrder(${session.id}) background side effects failed after backgroundWorkMs=${backgroundWorkMs.toFixed(1)}ms: ${(error as Error).message}`,
          (error as Error).stack,
        );
      });

    return result;
  }

  /**
   * Guest self-ordering from /guest (OTP-verified customers only — enforced
   * by the controller's CustomerJwtAuthGuard check, not here). Kept separate
   * from create() rather than widening its signature: source/orderSource
   * are hardcoded here (never caller-supplied), and there's no staff
   * `createdBy` — matches the 'online'/'qr' origin columns that already
   * exist on the entity for exactly this case.
   */
  /**
   * One shared cart per table visit: if the table session already has an
   * open order (from this guest, another guest at the same table, or staff
   * POS), new items land on it instead of spawning a separate order —
   * "Order sent" for the first round, then every later round is just more
   * items on the same order/ticket flow. Only opens a fresh order when the
   * session doesn't have one yet (or its only order(s) are already
   * completed/cancelled).
   */
  async createFromGuest(
    outletId: number,
    tableSessionId: number,
    customerId: number | null,
    items: CreateOrderItemDto[],
    diningTableId: number,
    tableName: string,
  ): Promise<Order> {
    await this.operatingHoursService.assertOperational(outletId);
    const existing = (
      await this.findOpenForTableSession(tableSessionId)
    ).find((order) => order.status !== 'completed');

    const saved =
      existing ??
      (await this.dataSource.transaction((manager) =>
        this.insertOrderWithBillNumber(manager, outletId, (billId, billNumber) =>
          manager.create(Order, {
            outletId,
            tableSessionId,
            customerId,
            orderType: 'table',
            orderNumber: this.generateOrderNumber(outletId),
            createdBy: null,
            source: 'online',
            orderSource: 'qr',
            billId,
            billNumber,
          }),
        ),
      ));

    if (existing) {
      await this.reopenForNewItems(
        saved.id,
        'New items added by a guest after this round was already served',
      );
    }

    // Batched rather than one addItem() call per item: addItemsBatch defers
    // recalculateTotals to a single pass after the whole cart lands, instead
    // of recomputing the order's subtotal/grandTotal from scratch after each
    // individual item (the N+1 that made multi-item guest carts slow).
    await this.addItemsBatch(saved.id, items);

    // Guest checkout is an explicit "Place order" action, so send its new
    // items through the same authoritative kitchen-routing path as staff POS.
    await this.sendToKitchen(saved.id, null);

    /*
    // Deliberately NOT auto-sent to the kitchen: a guest placing an order
    // should land in 'pending' ("Order sent" on the guest tracker) and stay
    // there until a staff member reviews and accepts it — via the same
    // POST /orders/:id/send-to-kitchen a staff-built cart uses (see
    // cart-panel.tsx's "Place order" button), which is what actually
    // advances 'pending' -> 'accepted'. Applies to every round a guest adds,
    // not just the first — new items always wait for staff to send them.

    */
    // Fire-and-forget: the guest's own response doesn't depend on staff's
    // notification row existing yet, and NotificationsService.create's own
    // external dispatch is already fire-and-forget internally — no reason to
    // make the guest wait on this DB write too.
    this.notificationsService
      .create({
        outletId,
        type: 'guest_order_placed',
        // Urgent: this is the one event a staff member must not miss even
        // with the app backgrounded — it's the only thing that unlocks push
        // (see PushService#sendToUser's priority gate). A busy floor with
        // the tab out of focus is exactly when a guest order is likely to
        // sit unseen otherwise.
        priority: 'urgent',
        title: existing ? 'Guest Order Updated' : 'New Guest Order',
        body: `${tableName} ${existing ? 'added items to their order' : 'placed a new order'}`,
        orderId: saved.id,
        tableName,
        data: JSON.stringify({ tableSessionId, diningTableId, customerId }),
      })
      .then((notification) => this.gateway.notifyNotificationCreated(notification))
      .catch((error) => this.logger.error(`Failed to create guest_order_placed notification: ${(error as Error).message}`));

    const full = await this.findOne(saved.id);
    this.gateway.notifyGuestOrderChanged(full);
    return full;
  }

  /**
   * The table's shared order(s) on this specific session, most recent
   * first — for /guest order tracking. A table session now carries one
   * shared cart (see createFromGuest), so this is scoped to tableSessionId
   * alone, not the requesting guest's own customerId: any phone-verified
   * guest sitting at the table sees and can cancel the same order,
   * regardless of who on the table actually added which item. Scoped to a
   * tableSessionId (not just outletId) so a phone number's orders from a
   * previous, unrelated visit never surface here either.
   */
  async findMineForCustomer(
    tableSessionId: number,
  ): Promise<
    (Order & {
      items: OrderItemWithRelations[];
      foodStatusCounts: NamedFoodStatusCount[];
    })[]
  > {
    const orders = await this.ordersRepository.find({
      where: { tableSessionId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    // One batched projection for all order items, rather than one query per
    // order. Guest tracking only needs food/variant names; addons and stock
    // reservations are intentionally excluded from this read model.
    const allItems = orders.length
      ? await this.orderItemsRepository.find({
          where: { orderId: In(orders.map((order) => order.id)) },
          relations: ['food', 'foodVariant'],
          order: { createdAt: 'ASC' },
        })
      : [];
    const itemsByOrder = new Map<number, OrderItem[]>();
    for (const item of allItems) {
      const items = itemsByOrder.get(item.orderId) ?? [];
      items.push(item);
      itemsByOrder.set(item.orderId, items);
    }

    // Kitchen progress comes from the counts rollup, not from each item's own
    // status column, so the guest tracker and every staff screen are reading
    // the same source. The raw items stay for the bill lines (price, note,
    // held flag) — what they no longer decide is how far along anything is.
    const countRows = orders.length
      ? await this.nameFoodStatusCounts(
          await this.tableSessionFoodStatusCountsRepository.find({
            where: { orderId: In(orders.map((order) => order.id)) },
          }),
        )
      : [];
    const countsByOrder = new Map<number, typeof countRows>();
    for (const row of countRows) {
      const rows = countsByOrder.get(row.orderId) ?? [];
      rows.push(row);
      countsByOrder.set(row.orderId, rows);
    }

    return orders.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) ?? [],
      foodStatusCounts: countsByOrder.get(order.id) ?? [],
    })) as (Order & {
      items: OrderItemWithRelations[];
      foodStatusCounts: NamedFoodStatusCount[];
    })[];
  }

  async update(id: number, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    await this.operatingHoursService.assertOperational(order.outletId);
    OrdersService.assertMutable(order);

    if (dto.customerId !== undefined && dto.customerId !== null) {
      await this.customersService.findOne(dto.customerId);
    }

    // Bound every incoming money field against the order's own
    // freshly-computed subtotal (never a client-supplied figure) before
    // any of it is persisted — a discount/tax/service-charge that could
    // exceed what's actually on the order is a straight path to a
    // negative or inflated bill.
    const subtotal = await this.computeBillableSubtotal(id);
    const discountType = dto.discountType ?? order.discountType;
    const discountValue = dto.discountValue ?? order.discountValue;
    if (discountType === 'percentage' && discountValue > 100) {
      throw new BadRequestException(
        'Percentage discount cannot exceed 100%',
      );
    }
    if (discountType === 'flat' && discountValue > subtotal) {
      throw new BadRequestException(
        `Discount (${discountValue}) cannot exceed the order subtotal (${subtotal})`,
      );
    }
    Object.assign(order, {
      ...(dto.customerId !== undefined && { customerId: dto.customerId }),
      ...(dto.note !== undefined && { note: dto.note }),
      ...(dto.discountType !== undefined && { discountType: dto.discountType }),
      ...(dto.discountValue !== undefined && {
        discountValue: dto.discountValue,
      }),
    });
    await this.ordersRepository.save(order);

    return this.recalculateTotals(id);
  }

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    changedBy: number | null,
  ): Promise<Order> {
    const order = await this.findOne(id);
    await this.operatingHoursService.assertOperational(order.outletId);
    const fromStatus = order.status;

    // A "pending" order that never had anything added to it (customer sat
    // down and left, or staff started a sale by mistake) has nothing to
    // send to kitchen or serve — the normal pending -> accepted -> ... ->
    // served -> completed path can never fire for it, which would trap
    // the table it's attached to as permanently occupied. Skip straight to
    // completed, but only when there's truly nothing on the order — any
    // order with real items still has to go through the normal flow.
    const isEmptyPendingCompletion =
      fromStatus === 'pending' &&
      dto.status === 'completed' &&
      (await this.orderItemsRepository.count({ where: { orderId: id } })) === 0;

    if (
      dto.status !== fromStatus &&
      !isEmptyPendingCompletion &&
      !ORDER_STATUS_TRANSITIONS[fromStatus].includes(dto.status)
    ) {
      throw new ConflictException(
        `Order ${id} cannot move from "${fromStatus}" to "${dto.status}"`,
      );
    }

    if (dto.status === 'completed' && changedBy === null) {
      // No guest-facing "complete" route exists — only staff drive an order
      // to completion, so a real actor is always expected here. Checked
      // before anything is persisted (the DB now hard-locks a completed
      // order's row, so this can't be a "complete now, reject after" step).
      throw new BadRequestException(
        'Completing an order requires a staff actor',
      );
    }

    // Repair totals before the completion check. Payment creation and order
    // item/status updates can finish very close together; in that case the
    // order row may briefly retain an old paid/due snapshot even though the
    // payment ledger already contains the payment.
    if (dto.status === 'completed') {
      await this.recalculatePayments(id);
      Object.assign(order, await this.findOne(id));
    }

    if (dto.status === 'completed' && order.dueAmount > 0.01) {
      // Same "checked before anything is persisted" reasoning as above —
      // an order can't be marked complete (closing out the table/session)
      // while it still has an outstanding balance; dueAmount is kept in
      // sync by recalculateTotals/recalculatePayments on every relevant
      // mutation, so this reads the authoritative persisted figure rather
      // than recomputing it.
      throw new ConflictException(
        `Order ${id} still has a due amount of ${order.dueAmount} — record full payment before completing`,
      );
    }

    order.status = dto.status;
    if (dto.status === 'completed') {
      order.completedAt = new Date();
    }
    if (dto.status === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancelledBy = changedBy;
      if (dto.cancelReason !== undefined) {
        order.cancelReason = dto.cancelReason;
      }
    }

    // Loyalty points earned on completion are folded into `order` here —
    // before the single save below — rather than a second save afterward:
    // once that save commits the row as 'completed', the DB trigger that
    // locks completed orders would reject any further UPDATE to it.
    if (dto.status === 'completed' && order.customerId) {
      try {
        const loyaltySettings = await this.settingsService.getLoyaltySettings();
        const pointsPerCurrencyUnit = Number(
          loyaltySettings.pointsPerCurrencyUnit ?? 0,
        );
        const pointsToEarn = Math.floor(order.grandTotal * pointsPerCurrencyUnit);
        if (pointsToEarn > 0) {
          await this.loyaltyService.earnPoints(
            order.customerId,
            pointsToEarn,
            'order_purchase',
            { orderId: order.id, userId: changedBy as number },
          );
          order.loyaltyPointsEarned = pointsToEarn;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to award loyalty points for order ${order.id}: ${(error as Error).message}`,
        );
      }
    }

    const saved = await this.ordersRepository.save(order);
    this.gateway.notifyGuestOrderChanged(saved);

    await this.orderStatusHistoriesRepository.save(
      this.orderStatusHistoriesRepository.create({
        orderId: id,
        changedBy,
        fromStatus,
        toStatus: dto.status,
        note: dto.note ?? null,
      }),
    );

    if (dto.status === 'completed') {
      await this.consumeReservationsForOrder(id, changedBy as number);
      await this.freeTableForCompletedOrder(saved, changedBy as number);
      // See KitchenTicketsService#closeAllForOrder — without this, an order
      // paid out while a ready item's "Deliver" tap never happened leaves
      // that ticket permanently stuck open, since order_items are now
      // frozen and can never reach 'served' to close it naturally.
      await this.kitchenTicketsService.closeAllForOrder(id);
    } else if (dto.status === 'served' && fromStatus !== 'served') {
      // Closes the loop the waiter-facing push flow needs: placed
      // (order_sent) -> ready (kitchen_ready) -> served. Fires once, on the
      // actual transition into 'served' — both the explicit "Mark
      // Delivered" route and maybeAdvanceToServed's auto-advance land here,
      // and the fromStatus guard keeps a redundant same-status save quiet.
      // Fire-and-forget: the status change above is already committed, so a
      // notification hiccup shouldn't fail this otherwise-successful request.
      this.notificationsService
        .create({
          outletId: saved.outletId,
          type: 'order_served',
          title: `Order ${saved.orderNumber} served`,
          orderId: saved.id,
          actorUserId: changedBy,
        })
        .then((notification) => this.gateway.notifyNotificationCreated(notification))
        .catch((error: Error) =>
          this.logger.error(`Failed to create order_served notification for order ${saved.id}: ${error.message}`),
        );
    } else if (dto.status === 'cancelled') {
      await this.releaseReservationsForOrder(id);
      await this.kitchenTicketsService.cancelAllForOrder(id);
      if (saved.loyaltyPointsEarned > 0 || saved.loyaltyPointsRedeemed > 0) {
        try {
          await this.loyaltyService.reverseForRefund(saved.id, changedBy);
        } catch (error) {
          this.logger.warn(
            `Failed to reverse loyalty points for order ${saved.id}: ${(error as Error).message}`,
          );
        }
      }
      try {
        // No-op if the order was never charged to a customer's tab.
        await this.customerCreditService.reverseForRefund(saved.id, changedBy);
      } catch (error) {
        this.logger.warn(
          `Failed to reverse customer credit charge for order ${saved.id}: ${(error as Error).message}`,
        );
      }
      // Fire-and-forget: the cancellation above is already committed, so a
      // notification hiccup shouldn't fail this otherwise-successful request.
      this.notificationsService
        .create({
          outletId: saved.outletId,
          type: 'order_cancelled',
          priority: 'high',
          title: `Order ${saved.orderNumber} cancelled`,
          body: dto.cancelReason ?? null,
          orderId: saved.id,
          actorUserId: changedBy,
        })
        .then((notification) => this.gateway.notifyNotificationCreated(notification))
        .catch((error: Error) =>
          this.logger.error(`Failed to create order_cancelled notification for order ${saved.id}: ${error.message}`),
        );
    }

    return saved;
  }

  /**
   * On order completion: the table session auto-closes (and the table frees)
   * once the customer has left — i.e. when the completed order is the last
   * active order on the session. Deliberately NOT tied to billing: a party
   * that completes their order and walks (even with an open tab) frees the
   * table, per the product's "close only after the customer leaves" rule.
   */
  private async freeTableForCompletedOrder(
    order: Order,
    changedBy: number,
  ): Promise<void> {
    if (order.tableSessionId === null) {
      return;
    }
    const session = await this.tableSessionsService.findOne(
      order.tableSessionId,
    );
    if (session.status !== 'active' && session.status !== 'billing') {
      return;
    }

    const sessionOrders = await this.ordersRepository.find({
      where: { tableSessionId: order.tableSessionId },
    });
    const hasOtherActiveOrder = sessionOrders.some(
      (other) =>
        other.id !== order.id &&
        other.status !== 'completed' &&
        other.status !== 'cancelled',
    );
    if (!hasOtherActiveOrder) {
      await this.tableSessionsService.end(session.id, changedBy);
    }
  }

  /**
   * Places the order: moves every non-held 'stock_reserved' item to
   * 'sent_to_kitchen' and groups them into one KitchenTicket per department
   * represented. Items with no preparationDepartmentId (ready-made, no prep
   * needed) skip the kitchen queue but not the workflow — they land straight
   * on the waiter's ready-to-deliver queue ('ready' status, ticket item
   * created pre-ready) instead of being silently marked 'served' with nobody
   * having touched them. Held items stay in the cart. If the order is still
   * 'pending', also advances it to 'accepted'; if everything sent turns out
   * to already be fully served (e.g. everyone already delivered), advances
   * it straight to 'served' too.
   */
  async sendToKitchen(
    orderId: number,
    changedBy: number | null,
    itemIds?: number[],
    options: { order?: Order } = {},
  ): Promise<{ orderId: number; itemIds: number[]; ticketIds: number[] }> {
    const order = options.order ?? await this.findOne(orderId);
    OrdersService.assertMutable(order);
    const [, items] = await Promise.all([
      this.operatingHoursService.assertOperational(order.outletId),
      this.orderItemsRepository.find({
        where: itemIds?.length
          ? { id: In(itemIds), orderId, status: 'stock_reserved' }
          : { orderId, status: 'stock_reserved' },
      }),
    ]);
    if (itemIds?.length && items.length !== new Set(itemIds).size) {
      throw new BadRequestException('One or more order item IDs are invalid or already placed');
    }
    const eligible = items.filter((item) => !item.isHeld);
    if (eligible.length === 0) {
      throw new BadRequestException(
        items.some((item) => item.isHeld)
          ? 'Every pending item is held — fire the held items to send them'
          : 'No items to send to kitchen',
      );
    }
    const tickets = await this.sendItemsToKitchen(order, eligible, changedBy);
    return {
      orderId,
      itemIds: eligible.map((item) => item.id),
      ticketIds: tickets.map((ticket) => ticket.id),
    };
  }

  /**
   * "Fire Held Items": routes every held 'stock_reserved' item to the
   * kitchen (un-holding them as they go) — the "bring drinks first" flow.
   */
  async fireHeldItems(
    orderId: number,
    changedBy: number | null,
  ): Promise<KitchenTicket[]> {
    const order = await this.findOne(orderId);
    await this.operatingHoursService.assertOperational(order.outletId);
    OrdersService.assertMutable(order);
    const held = await this.orderItemsRepository.find({
      where: { orderId, status: 'stock_reserved', isHeld: true },
    });
    if (held.length === 0) {
      throw new BadRequestException('No held items to fire');
    }
    for (const item of held) {
      item.isHeld = false;
    }
    return this.sendItemsToKitchen(order, held, changedBy);
  }

  private async sendItemsToKitchen(
    order: Order,
    items: OrderItem[],
    changedBy: number | null,
  ): Promise<KitchenTicket[]> {
    const groups = new Map<number | null, OrderItem[]>();
    for (const item of items) {
      const key = item.preparationDepartmentId;
      const group = groups.get(key);
      if (group) {
        group.push(item);
      } else {
        groups.set(key, [item]);
      }
    }

    const ticketResult = await this.dataSource.transaction(async (manager) => {
      const ticketRepo = manager.getRepository(KitchenTicket);
      const ticketItemRepo = manager.getRepository(KitchenTicketItem);
      const itemRepo = manager.getRepository(OrderItem);

      const createdTickets: KitchenTicket[] = [];
      const readyMade: { ticketId: number; itemIds: number[] }[] = [];
      const now = new Date();
      for (const [departmentId, groupItems] of groups) {
        if (departmentId === null) {
          // Ready-made items (drinks, pre-made snacks, ...) — no prep needed,
          // so they never enter the kitchen queue, but they still go to the
          // waiter's ready-to-deliver queue rather than being auto-served
          // with nobody having actually handed them over.
          const ticket = await ticketRepo.save(
            ticketRepo.create({
              orderId: order.id,
              outletId: order.outletId,
              departmentId: null,
              status: 'in_progress',
              startedAt: now,
            }),
          );
          const itemIds: number[] = [];
          const ticketItems = groupItems.map((item) =>
            ticketItemRepo.create({
                ticketId: ticket.id,
                orderItemId: item.id,
                startedAt: now,
                readyAt: now,
              }),
          );
          const savedTicketItems = await ticketItemRepo.save(ticketItems);
          for (const [index, item] of groupItems.entries()) {
            itemIds.push(savedTicketItems[index].id);
            item.status = 'ready';
          }
          await itemRepo.save(groupItems);
          createdTickets.push(ticket);
          readyMade.push({ ticketId: ticket.id, itemIds });
          continue;
        }
        const ticket = await ticketRepo.save(
          ticketRepo.create({
            orderId: order.id,
            outletId: order.outletId,
            departmentId,
            status: 'open',
          }),
        );
        await ticketItemRepo.save(groupItems.map((item) =>
          ticketItemRepo.create({
              ticketId: ticket.id,
              orderItemId: item.id,
            }),
        ));
        for (const item of groupItems) {
          item.status = 'sent_to_kitchen';
        }
        await itemRepo.save(groupItems);
        createdTickets.push(ticket);
      }
      return { createdTickets, readyMade };
    });

    const { createdTickets: tickets, readyMade } = ticketResult;
    const kitchenBound = tickets.filter((t) => t.departmentId !== null);

    if (order.status === 'pending' && kitchenBound.length === 0) {
      // Nothing sent needs a kitchen — every item was ready-made (drinks,
      // pre-made snacks), so there's no ticket for kitchen staff to accept.
      // Walk the order straight to whatever stage its items actually
      // reached instead of stopping at 'accepted'.
      await this.syncStatusFromItems(order.id, changedBy);
    }
    // Otherwise the order stays 'pending' ("placed") — it only becomes
    // 'accepted' once kitchen staff act on the ticket (see
    // KitchenTicketsService.startTicket -> syncStatusFromItems), not merely
    // because staff sent it to the kitchen queue.
    await this.maybeAdvanceToServed(order.id, changedBy);
    // Fire-and-forget: both are pure broadcast — a relation-heavy refetch per
    // ticket so the KDS gets a fully hydrated payload, then a notification
    // per ready-made group. The tickets are already committed, and every
    // listener also refetches on the push, so making the guest wait on this
    // only added latency to "Place order" for no correctness gain.
    void (async () => {
      try {
        if (kitchenBound.length > 0) {
          await this.kitchenTicketsService.notifyTicketsCreated(kitchenBound);
        }
        for (const { ticketId, itemIds } of readyMade) {
          await this.kitchenTicketsService.notifyItemsReady(ticketId, itemIds);
        }
      } catch (error) {
        this.logger.error(
          `Failed to push kitchen updates for order ${order.id}: ${(error as Error).message}`,
        );
      }
    })();
    // Only announce "sent to kitchen" when something actually went to a
    // kitchen station — a send that's entirely ready-made items never
    // touches the kitchen, and notifyItemsReady above already alerts the
    // waiter directly, so a redundant/misleading "sent to kitchen" here
    // would just be noise (and a duplicate sound) on top of that.
    if (kitchenBound.length > 0) {
      // Fire-and-forget, same reasoning as createFromGuest's notification —
      // sending to the kitchen shouldn't wait on this DB write.
      this.notificationsService
        .create({
          outletId: order.outletId,
          type: 'order_sent',
          title: `Order ${order.orderNumber} sent to kitchen`,
          orderId: order.id,
          actorUserId: changedBy,
          data: JSON.stringify({ ticketCount: tickets.length }),
        })
        .then((notification) => this.gateway.notifyNotificationCreated(notification))
        .catch((error) => this.logger.error(`Failed to create order_sent notification: ${(error as Error).message}`));
    }
    return tickets;
  }

  /**
   * Auto-advance Order.status to 'served' once the counts say every
   * remaining unit has been served. Called whenever an item transitions to
   * 'served' via kitchen-ticket progress (including a waiter delivering a
   * ready-made item off the ready queue).
   *
   * Deliberately narrower than syncStatusFromItems despite sharing its
   * derivation: call sites that must not push a 'pending' order to
   * 'accepted' — sending to the kitchen queue isn't the kitchen accepting
   * it — still want this terminal hop when the last item is delivered.
   */
  async maybeAdvanceToServed(
    orderId: number,
    changedBy: number | null,
  ): Promise<void> {
    const counts = await this.tableSessionFoodStatusCountsRepository.find({
      where: { orderId },
    });
    if (deriveOrderStageFromCounts(counts) !== 'served') return;

    const order = await this.findOne(orderId);
    if (
      order.status === 'served' ||
      order.status === 'completed' ||
      order.status === 'cancelled'
    ) {
      return;
    }
    await this.updateStatus(orderId, { status: 'served' }, changedBy);
  }

  /**
   * Every non-cancelled order on this table session, oldest first — the
   * basis for "pay for the whole table at once" (OrderPaymentsService#
   * payForTableSession) and completeAllForTableSession below, now that a
   * session can carry more than one order.
   */
  async findOpenForTableSession(tableSessionId: number): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { tableSessionId, status: Not('cancelled') },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Completes every still-open order on a table session in one action, once
   * every one of them is fully paid — the other half of "pay for the whole
   * table at once": OrderPaymentsService#payForTableSession settles the
   * balances (possibly across several orders), this closes them all out
   * together instead of staff completing each order one at a time. Reuses
   * updateStatus() per order so loyalty/notifications/table-freeing all fire
   * exactly as a normal single-order completion would (freeTableForCompletedOrder
   * already ends the session once its last active order completes).
   */
  async completeAllForTableSession(
    tableSessionId: number,
    changedBy: number,
  ): Promise<Order[]> {
    const orders = await this.findOpenForTableSession(tableSessionId);
    const payable = orders.filter((order) => order.status !== 'completed');
    if (payable.length === 0) {
      throw new BadRequestException(
        `Table session ${tableSessionId} has no open orders to complete`,
      );
    }
    const unpaid = payable.filter((order) => order.dueAmount > 0);
    if (unpaid.length > 0) {
      throw new ConflictException(
        `Table session ${tableSessionId} still has ${unpaid.length} order(s) with an outstanding balance`,
      );
    }

    const completed: Order[] = [];
    for (const order of payable) {
      completed.push(
        await this.updateStatus(order.id, { status: 'completed' }, changedBy),
      );
    }
    return completed;
  }

  // ------------------------------------------------------------ order items

  async listItems(
    query: ListOrderItemsQueryDto,
  ): Promise<PaginatedResponse<WaiterOrderItemResponseDto>> {
    const { page, limit, orderId, tableSessionId } = query;

    const [items, total] = await this.orderItemsRepository.findAndCount({
      where: orderId !== undefined ? { orderId } : { tableSessionId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: await this.toWaiterItems(items),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Every (food, variant) line of one order, with how many units sit in each
   * stage right now. Reads table_session_food_status_counts — kept in sync by
   * a DB trigger on order_items (see migration 1781500000000), never written
   * here — so this and Order.status can't disagree about the same order.
   */
  async listFoodStatusCountsForOrder(orderId: number) {
    const rows = await this.tableSessionFoodStatusCountsRepository.find({
      where: { orderId },
    });
    return this.nameFoodStatusCounts(rows);
  }

  /**
   * The same counts rolled up across every order on a table's visit — a
   * session can span several orders (new round, split bill), which the row
   * grain deliberately keeps separate, so the rollup happens here rather
   * than in the table.
   */
  async listFoodStatusCountsForTableSession(tableSessionId: number) {
    const rows = await this.tableSessionFoodStatusCountsRepository.find({
      where: { tableSessionId },
    });

    const merged = new Map<string, TableSessionFoodStatusCount>();
    for (const row of rows) {
      const key = `${row.foodId}:${row.foodVariantId ?? -1}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...row });
        continue;
      }
      existing.reservedCount += row.reservedCount;
      existing.orderedCount += row.orderedCount;
      existing.preparingCount += row.preparingCount;
      existing.readyCount += row.readyCount;
      existing.servedCount += row.servedCount;
      existing.cancelledCount += row.cancelledCount;
      if (row.createdAt < existing.createdAt) existing.createdAt = row.createdAt;
      if (row.updatedAt > existing.updatedAt) existing.updatedAt = row.updatedAt;
    }

    return this.nameFoodStatusCounts([...merged.values()]);
  }

  /** Batches the food/variant name lookups both status-count reads need. */
  private async nameFoodStatusCounts(
    rows: TableSessionFoodStatusCount[],
  ): Promise<NamedFoodStatusCount[]> {
    const variantIds = rows
      .map((row) => row.foodVariantId)
      .filter((id): id is number => id !== null);
    const [foods, variants] = await Promise.all([
      this.foodsService.findByIds([...new Set(rows.map((row) => row.foodId))]),
      variantIds.length
        ? this.foodVariantsService.findByIds([...new Set(variantIds)])
        : Promise.resolve([]),
    ]);
    const foodNameById = new Map(foods.map((food) => [food.id, food.name]));
    const variantNameById = new Map(
      variants.map((variant) => [variant.id, variant.name]),
    );

    return rows.map((row) => ({
      orderId: row.orderId,
      foodId: row.foodId,
      foodName: foodNameById.get(row.foodId) ?? `Item #${row.foodId}`,
      foodVariantId: row.foodVariantId,
      foodVariantName:
        row.foodVariantId === null
          ? null
          : (variantNameById.get(row.foodVariantId) ?? null),
      tableSessionId: row.tableSessionId,
      reservedCount: row.reservedCount,
      orderedCount: row.orderedCount,
      preparingCount: row.preparingCount,
      readyCount: row.readyCount,
      servedCount: row.servedCount,
      cancelledCount: row.cancelledCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Maps raw OrderItem rows to the minimal, name-enriched shape
   * GET /order-items actually returns (see WaiterOrderItemResponseDto for
   * why) — batches food/variant/addon name lookups instead of resolving
   * them per item, same N+1-avoidance as attachItemRelations.
   */
  private async toWaiterItems(
    items: OrderItem[],
  ): Promise<WaiterOrderItemResponseDto[]> {
    const foodIds = [...new Set(items.map((item) => item.foodId))];
    const variantIds = [
      ...new Set(
        items
          .map((item) => item.foodVariantId)
          .filter((id): id is number => id !== null),
      ),
    ];
    const itemIds = items.map((item) => item.id);

    const [foods, variants, addons] = await Promise.all([
      this.foodsService.findByIds(foodIds),
      this.foodVariantsService.findByIds(variantIds),
      itemIds.length
        ? this.orderItemAddonsRepository.find({
            where: { orderItemId: In(itemIds) },
          })
        : Promise.resolve([]),
    ]);
    const addonIds = [...new Set(addons.map((addon) => addon.addonId))];
    const addonDefs = await this.addonsService.findByIds(addonIds);

    const foodNameById = new Map(foods.map((food) => [food.id, food.name]));
    const variantNameById = new Map(
      variants.map((variant) => [variant.id, variant.name]),
    );
    const addonNameById = new Map(
      addonDefs.map((addon) => [addon.id, addon.name]),
    );
    const addonsByItem = new Map<number, OrderItemAddon[]>();
    for (const addon of addons) {
      const group = addonsByItem.get(addon.orderItemId);
      if (group) {
        group.push(addon);
      } else {
        addonsByItem.set(addon.orderItemId, [addon]);
      }
    }

    return items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      tableSessionId: item.tableSessionId,
      foodId: item.foodId,
      foodName: foodNameById.get(item.foodId) ?? `Item #${item.foodId}`,
      foodVariantId: item.foodVariantId,
      variantName:
        item.foodVariantId !== null
          ? (variantNameById.get(item.foodVariantId) ?? null)
          : null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount: item.totalAmount,
      status: item.status,
      isHeld: item.isHeld,
      note: item.note,
      packagingType: item.packagingType,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      addons: (addonsByItem.get(item.id) ?? []).map((addon) => ({
        id: addon.id,
        addonId: addon.addonId,
        addonName: addonNameById.get(addon.addonId) ?? `Addon #${addon.addonId}`,
        quantity: addon.quantity,
        unitPrice: addon.unitPrice,
        totalAmount: addon.totalAmount,
      })),
    }));
  }

  async findItem(id: number): Promise<OrderItem> {
    const item = await this.orderItemsRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Order item ${id} not found`);
    }
    return item;
  }

  /**
   * Batches addons + ingredient reservations for a page of order items into
   * two queries (instead of the caller doing one of each per item — the
   * classic N+1 that /order-items/:id/addons and /order-items/:id/reservations
   * used to force on every consumer that rendered a cart/order-detail row).
   */
  private async attachItemRelations(
    items: OrderItem[],
  ): Promise<OrderItemWithRelations[]> {
    const itemIds = items.map((item) => item.id);
    const [addons, reservations] = itemIds.length
      ? await Promise.all([
          this.orderItemAddonsRepository.find({
            where: { orderItemId: In(itemIds) },
          }),
          this.reservationsRepository.find({
            where: { orderItemId: In(itemIds) },
          }),
        ])
      : [[], []];

    const addonsByItem = new Map<number, OrderItemAddon[]>();
    for (const addon of addons) {
      const group = addonsByItem.get(addon.orderItemId);
      if (group) {
        group.push(addon);
      } else {
        addonsByItem.set(addon.orderItemId, [addon]);
      }
    }

    const reservationsByItem = new Map<
      number,
      OrderItemIngredientReservation[]
    >();
    for (const reservation of reservations) {
      const group = reservationsByItem.get(reservation.orderItemId);
      if (group) {
        group.push(reservation);
      } else {
        reservationsByItem.set(reservation.orderItemId, [reservation]);
      }
    }

    return items.map((item) => ({
      ...item,
      addons: addonsByItem.get(item.id) ?? [],
      reservations: reservationsByItem.get(item.id) ?? [],
    }));
  }

  /**
   * Server-side kitchen routing: resolves a food's departmentType to this
   * order's outlet's matching prep-capable OutletDepartment. Never blocks
   * adding an item — falls back to null (no prep routing, ready-made) if the
   * food has no departmentType, or no matching department exists at this
   * outlet. Pure (no I/O) — food/departments are already-fetched by the
   * caller, which lets addItemsBatch fetch the outlet's department list once
   * per batch instead of once per item.
   */
  private resolvePreparationDepartmentId(
    food: Food,
    departments: OutletDepartment[],
  ): number | null {
    if (!food.departmentType) {
      return null;
    }
    const match = departments.find(
      (d) => d.type === food.departmentType && d.canPrepareOrder,
    );
    return match?.id ?? null;
  }

  async addItem(
    orderId: number,
    dto: CreateOrderItemDto,
    options: {
      order?: Order;
      departments?: OutletDepartment[];
      deferTotals?: boolean;
      /** Caller runs the recompute itself once the whole batch has landed. */
      deferReservations?: boolean;
    } = {},
  ): Promise<OrderItem> {
    const order = options.order ?? await this.findOne(orderId);
    OrdersService.assertMutable(order);

    // Independent lookups (none depends on another's result) fired together
    // instead of chained — on this DB's remote pooler each round trip runs
    // ~150-200ms even warm, so three sequential awaits here cost ~3x what
    // running them concurrently does.
    const [, food, departments] = await Promise.all([
      this.operatingHoursService.assertOperational(order.outletId),
      this.foodsService.findOne(dto.foodId),
      options.departments
        ? Promise.resolve(options.departments)
        : this.outletDepartmentsService.findByOutlet(order.outletId),
    ]);

    const preparationDepartmentId = this.resolvePreparationDepartmentId(
      food,
      departments,
    );

    let unitPrice: number;
    if (dto.foodVariantId !== undefined) {
      const { variant, price } =
        await this.foodVariantsService.resolvePriceForOutlet(
          dto.foodVariantId,
          order.outletId,
        );
      if (variant.foodId !== dto.foodId) {
        throw new BadRequestException(
          `Food variant ${dto.foodVariantId} does not belong to food ${dto.foodId}`,
        );
      }
      unitPrice = price;
    } else {
      // `food` is already fetched above — reused here instead of paying for
      // resolvePriceForOutlet's own internal findOne() a second time.
      const { price } = await this.foodsService.resolvePriceForOutlet(
        dto.foodId,
        order.outletId,
        food,
      );
      unitPrice = price;
    }

    const quantity = dto.quantity ?? 1;
    const packagingType = dto.packagingType ?? 'plating';

    // Re-adding the same food (same variant/note/packaging) while its prior
    // row is still an editable cart line is a quantity bump, not a new order
    // line. This upserts on the DB's partial unique index
    // idx_order_items_merge_key (order_id, food_id, variant, note, packaging
    // WHERE status='stock_reserved' AND NOT is_held) instead of a
    // SELECT-then-insert, so two concurrent add requests for the same item
    // can't both see "no existing row" and both insert — the constraint, not
    // app logic, is what prevents the duplicate line. Rows already sent to
    // the kitchen or held fall outside that WHERE clause and always get a
    // fresh row.
    const upsert = await this.orderItemsRepository
      .createQueryBuilder()
      .insert()
      .into(OrderItem)
      .values({
        orderId,
        tableSessionId: order.tableSessionId ?? null,
        foodId: dto.foodId,
        foodVariantId: dto.foodVariantId ?? null,
        preparationDepartmentId,
        quantity,
        unitPrice,
        totalAmount: round2(quantity * unitPrice),
        note: dto.note ?? null,
        packagingType,
      })
      .onConflict(
        `(order_id, food_id, (COALESCE(food_variant_id, -1)), (COALESCE(note, '')), packaging_type) ` +
          `WHERE status = 'stock_reserved' AND is_held = false ` +
          `DO UPDATE SET quantity = order_items.quantity + EXCLUDED.quantity, ` +
          `total_amount = round((order_items.quantity + EXCLUDED.quantity) * order_items.unit_price, 2)`,
      )
      .returning('id, (xmax = 0) AS inserted')
      .execute();
    const { id, inserted } = upsert.raw[0] as { id: number; inserted: boolean };
    const saved = await this.findItem(id);

    if (!options.deferTotals) await this.recalculateTotals(orderId);
    if (options.deferReservations) return saved;
    try {
      await this.recalculateReservations(saved.id, order, food);
    } catch (error) {
      if (inserted) {
        // Fresh row — its ingredient requirement couldn't be reserved.
        await this.orderItemsRepository.remove(saved);
      } else {
        // Merged into an existing row — undo just the added quantity.
        saved.quantity = round2(saved.quantity - quantity);
        saved.totalAmount = round2(saved.quantity * saved.unitPrice);
        await this.orderItemsRepository.save(saved);
      }
      if (!options.deferTotals) await this.recalculateTotals(orderId);
      throw error;
    }
    return saved;
  }

  /**
   * POS "Place order" / guest checkout pushes the whole cart in one request.
   * Genuinely batched, not just looped: addItem()/addItemAddon() each cost
   * several sequential round trips (price resolution, the merge-upsert, a
   * refetch), and on this DB's remote pooler every round trip runs
   * ~150-200ms even warm — calling them once per cart line was the actual
   * source of "place order" taking seconds. This resolves prices for every
   * distinct food/variant in the cart in a fixed handful of queries
   * (regardless of cart size), then writes every item and every addon as one
   * multi-row INSERT each.
   *
   * Not wrapped in a single all-or-nothing DB transaction: matches the old
   * per-item behavior, where a line that fails validation (bad food id,
   * variant/food mismatch, unavailable at this outlet) doesn't take lines
   * that already resolved fine down with it — the reservation pass after
   * this is the one place a real transaction (and full rollback) applies.
   */
  async addItemsBatch(
    orderId: number,
    items: (CreateOrderItemDto & { addons?: CreateOrderItemAddonDto[] })[],
    options: { order?: Order } = {},
  ): Promise<OrderItem[]> {
    const order = options.order ?? await this.findOne(orderId);
    OrdersService.assertMutable(order);
    // Fetched once for the whole batch — every item in the same order shares
    // the same outlet, so addItem() would otherwise re-fetch this identical
    // list once per item. Runs alongside the operating-hours check since
    // neither depends on the other's result.
    const [, departments] = await Promise.all([
      this.operatingHoursService.assertOperational(order.outletId),
      this.outletDepartmentsService.findByOutlet(order.outletId),
    ]);

    let saved: OrderItem[] = [];
    try {
      if (items.length === 0) return saved;

      // Merge cart lines that would collide on the same upsert key up front
      // — a single multi-row INSERT can never target one row twice
      // (Postgres rejects that outright: "ON CONFLICT DO UPDATE command
      // cannot affect row a second time"), where two sequential addItem()
      // calls for the same key simply converge on it one at a time. This is
      // the same merge those sequential calls already perform on each
      // other, just done once, in JS, up front.
      interface MergedLine {
        foodId: number;
        foodVariantId: number | null;
        note: string | null;
        packagingType: OrderItemPackagingType;
        quantity: number;
        addons: CreateOrderItemAddonDto[];
      }
      const mergedByKey = new Map<string, MergedLine>();
      for (const { addons, ...itemDto } of items) {
        const key = `${itemDto.foodId}:${itemDto.foodVariantId ?? -1}:${itemDto.note ?? ''}:${itemDto.packagingType ?? 'plating'}`;
        const existing = mergedByKey.get(key);
        if (existing) {
          existing.quantity += itemDto.quantity ?? 1;
          existing.addons.push(...(addons ?? []));
          continue;
        }
        mergedByKey.set(key, {
          foodId: itemDto.foodId,
          foodVariantId: itemDto.foodVariantId ?? null,
          note: itemDto.note ?? null,
          packagingType: itemDto.packagingType ?? 'plating',
          quantity: itemDto.quantity ?? 1,
          addons: [...(addons ?? [])],
        });
      }
      const lines = [...mergedByKey.values()];

      const noVariantFoodIds = lines
        .filter((line) => line.foodVariantId === null)
        .map((line) => line.foodId);
      const variantIds = lines
        .filter((line): line is MergedLine & { foodVariantId: number } => line.foodVariantId !== null)
        .map((line) => line.foodVariantId);

      const [priceByFoodId, priceByVariantId] = await Promise.all([
        this.foodsService.resolvePricesForOutlet(noVariantFoodIds, order.outletId),
        this.foodVariantsService.resolvePricesForOutlet(variantIds, order.outletId),
      ]);
      // Variant lines still need their own Food row (department routing +
      // the variant->food consistency check below) — resolvePricesForOutlet
      // above only fetched foods for the no-variant lines, so batch whatever
      // it didn't already cover instead of refetching everything.
      const variantFoodIds = [
        ...new Set(
          lines
            .filter((line) => line.foodVariantId !== null)
            .map((line) => line.foodId),
        ),
      ];
      const extraFoods = variantFoodIds.length
        ? await this.foodsService.findByIds(variantFoodIds)
        : [];
      const foodById = new Map<number, Food>();
      for (const { food } of priceByFoodId.values()) foodById.set(food.id, food);
      for (const food of extraFoods) foodById.set(food.id, food);

      const rows = lines.map((line) => {
        const food = foodById.get(line.foodId);
        if (!food) throw new NotFoundException(`Food ${line.foodId} not found`);

        let unitPrice: number;
        if (line.foodVariantId !== null) {
          const resolved = priceByVariantId.get(line.foodVariantId);
          if (!resolved) {
            throw new NotFoundException(`Food variant ${line.foodVariantId} not found`);
          }
          if (resolved.variant.foodId !== line.foodId) {
            throw new BadRequestException(
              `Food variant ${line.foodVariantId} does not belong to food ${line.foodId}`,
            );
          }
          unitPrice = resolved.price;
        } else {
          const resolved = priceByFoodId.get(line.foodId);
          if (!resolved) throw new NotFoundException(`Food ${line.foodId} not found`);
          unitPrice = resolved.price;
        }

        return {
          line,
          values: {
            orderId,
            tableSessionId: order.tableSessionId ?? null,
            foodId: line.foodId,
            foodVariantId: line.foodVariantId,
            preparationDepartmentId: this.resolvePreparationDepartmentId(food, departments),
            quantity: line.quantity,
            unitPrice,
            totalAmount: round2(line.quantity * unitPrice),
            note: line.note,
            packagingType: line.packagingType,
          },
        };
      });

      // One multi-row INSERT for every line in the cart, same merge-upsert
      // semantics as addItem()'s single-row version (a re-add of an
      // already-cart-staged line bumps its quantity instead of creating a
      // second row) — see idx_order_items_merge_key.
      const upsert = await this.orderItemsRepository
        .createQueryBuilder()
        .insert()
        .into(OrderItem)
        .values(rows.map((row) => row.values))
        .onConflict(
          `(order_id, food_id, (COALESCE(food_variant_id, -1)), (COALESCE(note, '')), packaging_type) ` +
            `WHERE status = 'stock_reserved' AND is_held = false ` +
            `DO UPDATE SET quantity = order_items.quantity + EXCLUDED.quantity, ` +
            `total_amount = round((order_items.quantity + EXCLUDED.quantity) * order_items.unit_price, 2)`,
        )
        .returning('id, (xmax = 0) AS inserted')
        .execute();
      // Postgres preserves the VALUES-list order in RETURNING for a
      // multi-row INSERT, ON CONFLICT included — each source row produces
      // exactly one output row, in order — so this positional zip with
      // `rows` is safe.
      //
      // `id` comes back as a string here — this is a raw driver result, not
      // an entity, so none of OrderItem's column transformers ran. Every
      // `bigint` column in this codebase comes back from `pg` as a string by
      // default (see BigIntTransformer), and OrderItem.id normally goes
      // through that transformer to become a plain number; parseInt matches
      // it exactly so ids compare equal to the numbers `orderItemsRepository
      // .find()` returns below, instead of silently missing every Map
      // lookup keyed by them.
      const upsertResults = (upsert.raw as { id: string; inserted: boolean }[]).map(
        (row) => ({ id: parseInt(row.id, 10), inserted: row.inserted }),
      );

      // Every addon across every line, as one more multi-row INSERT.
      // Deliberately not merged/deduped like the items above — two lines
      // requesting the same addon on the same food always produced two
      // separate order_item_addon rows before, and still do here.
      const distinctAddonIds = [
        ...new Set(rows.flatMap((row) => row.line.addons.map((addon) => addon.addonId))),
      ];
      const addonById = distinctAddonIds.length
        ? new Map((await this.addonsService.findByIds(distinctAddonIds)).map((addon) => [addon.id, addon]))
        : new Map();
      const addonRows = rows.flatMap((row, index) => {
        const orderItemId = upsertResults[index].id;
        return row.line.addons.map((addonDto) => {
          const addon = addonById.get(addonDto.addonId);
          if (!addon) throw new NotFoundException(`Addon ${addonDto.addonId} not found`);
          const quantity = addonDto.quantity ?? 1;
          return {
            orderItemId,
            addonId: addon.id,
            quantity,
            unitPrice: addon.price,
            totalAmount: round2(quantity * addon.price),
          };
        });
      });
      if (addonRows.length > 0) {
        await this.orderItemAddonsRepository.insert(addonRows);
      }

      // One batched read back instead of addItem()'s per-row findItem() —
      // the POS "add items" endpoint returns this array directly to the
      // client, so it still needs full entities, just fetched once.
      const itemIds = upsertResults.map((result) => result.id);
      const itemById = new Map(
        (await this.orderItemsRepository.find({ where: { id: In(itemIds) } })).map(
          (item) => [item.id, item],
        ),
      );
      saved = itemIds.map((id) => itemById.get(id)!);

      // One transaction for the entire cart rather than one per item plus one
      // per addon. Each of those took FOR UPDATE locks on the same stock rows
      // and cost a full round trip to a remote pooler, which is what made
      // placing a guest order take seconds. Deferred to here (rather than
      // interleaved) so a cart that can't be stocked fails as a unit and
      // rolls the whole reservation set back with it.
      // rows/saved are already 1:1 with unique upsert keys (that's exactly
      // what the merge step above guaranteed), so unlike the old per-item
      // loop there's nothing left to dedupe here — each saved row's own
      // line.quantity is exactly what this batch contributed to it.
      const addedQuantities = new Map(
        rows.map((row, index) => [saved[index].id, row.line.quantity]),
      );
      // Most menu items aren't recipe-tracked and most cart lines carry no
      // addons — for those, the whole recalculateReservations call is just
      // two empty lookups (its own addons, its own existing reservations)
      // before it returns having done nothing. Batch those two lookups for
      // the WHOLE cart in one query each instead of paying for them per
      // item, and skip the real per-item pipeline entirely for anything
      // that comes back with nothing on either side — a food that isn't
      // recipe-enabled and has no addons and nothing already reserved has
      // no possible reservation to make.
      const savedItemIds = saved.map((item) => item.id);
      const [allAddons, allExisting] = await Promise.all([
        this.orderItemAddonsRepository.find({ where: { orderItemId: In(savedItemIds) } }),
        this.reservationsRepository.find({ where: { orderItemId: In(savedItemIds), status: 'reserved' } }),
      ]);
      const itemIdsWithAddons = new Set(allAddons.map((addon) => addon.orderItemId));
      const itemIdsWithExisting = new Set(allExisting.map((reservation) => reservation.orderItemId));
      const itemsNeedingReservationWork = saved.filter((item) => {
        const food = foodById.get(item.foodId);
        return (
          food?.itemType === 'kitchen' ||
          itemIdsWithAddons.has(item.id) ||
          itemIdsWithExisting.has(item.id)
        );
      });

      try {
        await this.dataSource.transaction(async (manager) => {
          // For the common case (no recipe, no addon recipe, no existing
          // reservation), the null-work short-circuit above already skipped
          // the entire pipeline. For the remaining subset, take the diff as a
          // batch across the whole cart instead of calling
          // recalculateReservations() once per item inside the transaction —
          // this keeps the correct inventory semantics while avoiding the
          // N-item serial round-trip pattern that was still dominating a 30
          // item cart.
          if (itemsNeedingReservationWork.length > 0) {
            await this.recalculateReservationsBatch(
              order,
              itemsNeedingReservationWork,
              foodById,
              manager,
            );
          }
        });
      } catch (error) {
        // The transaction already rolled back every stock/reservation write,
        // so only the item rows this batch added are left to undo. Subtract
        // exactly what was added — the merge-on-add upsert means a row may
        // predate this batch, and dropping it wholesale would take an
        // earlier round's quantity with it.
        for (const item of saved) {
          const added = addedQuantities.get(item.id) ?? 0;
          const remaining = round2(item.quantity - added);
          if (remaining > 0) {
            item.quantity = remaining;
            item.totalAmount = round2(remaining * item.unitPrice);
            await this.orderItemsRepository.save(item);
          } else {
            await this.orderItemsRepository.remove(item);
          }
        }
        throw error;
      }
      await this.recalculateTotals(orderId);
      return saved;
    } catch (error) {
      await this.recalculateTotals(orderId);
      throw error;
    }
  }

  async updateItem(id: number, dto: UpdateOrderItemDto): Promise<OrderItem> {
    const item = await this.findItem(id);
    const order = await this.findOne(item.orderId);
    await this.operatingHoursService.assertOperational(order.outletId);
    OrdersService.assertMutable(order);
    const previousQuantity = item.quantity;

    if (dto.quantity !== undefined) {
      item.quantity = dto.quantity;
      item.totalAmount = round2(dto.quantity * item.unitPrice);
    }
    Object.assign(item, {
      ...(dto.note !== undefined && { note: dto.note }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.cancelReason !== undefined && {
        cancelReason: dto.cancelReason,
      }),
      ...(dto.packagingType !== undefined && {
        packagingType: dto.packagingType,
      }),
    });
    if (dto.isHeld !== undefined) {
      if (item.status !== 'stock_reserved') {
        throw new BadRequestException(
          'Only items that have not been sent to the kitchen can be held or fired',
        );
      }
      if (dto.status !== undefined) {
        throw new BadRequestException(
          'Cannot change an item status and its held flag in the same request',
        );
      }
      item.isHeld = dto.isHeld;
    }
    const saved = await this.orderItemsRepository.save(item);

    await this.recalculateTotals(item.orderId);

    if (dto.quantity !== undefined) {
      try {
        await this.recalculateReservations(id);
      } catch (error) {
        saved.quantity = previousQuantity;
        saved.totalAmount = round2(previousQuantity * saved.unitPrice);
        await this.orderItemsRepository.save(saved);
        await this.recalculateTotals(item.orderId);
        throw error;
      }
    }

    return saved;
  }

  /**
   * Hard delete is only safe while the item is still 'stock_reserved' —
   * nothing downstream (kitchen ticket, prep, guest tracker) has seen it
   * yet. Once it's been sent to the kitchen, deleting the row would erase
   * the kitchen's record of it without a trace; void it instead (see
   * voidItem) so the removal is auditable and reason-carrying.
   */
  async removeItem(id: number): Promise<void> {
    const item = await this.findItem(id);
    const order = await this.findOne(item.orderId);
    await this.operatingHoursService.assertOperational(order.outletId);
    OrdersService.assertMutable(order);
    if (item.status !== 'stock_reserved') {
      throw new ConflictException(
        `Item ${id} has already been sent to the kitchen (status: ${item.status}) and can no longer be deleted — void it instead`,
      );
    }
    const reservations = await this.reservationsRepository.find({
      where: { orderItemId: id, status: 'reserved' },
    });
    for (const reservation of reservations) {
      await this.warehouseIngredientStocksService.reserve(
        reservation.warehouseId,
        reservation.ingredientId,
        -reservation.reservedQuantity,
      );
    }
    await this.orderItemsRepository.remove(item);
    await this.recalculateTotals(item.orderId);
  }

  /**
   * The post-kitchen equivalent of removeItem(): reason-required, keeps the
   * row (status -> 'cancelled') instead of deleting it, so a fired item's
   * history stays intact for audit. Reuses OrderItem's existing 'cancelled'
   * status rather than adding a new enum value/migration.
   */
  async voidItem(id: number, reason: string): Promise<OrderItem> {
    const item = await this.findItem(id);
    const order = await this.findOne(item.orderId);
    await this.operatingHoursService.assertOperational(order.outletId);
    OrdersService.assertMutable(order);
    if (item.status === 'cancelled') {
      throw new ConflictException(`Item ${id} is already voided`);
    }
    const reservations = await this.reservationsRepository.find({
      where: { orderItemId: id, status: 'reserved' },
    });
    for (const reservation of reservations) {
      await this.warehouseIngredientStocksService.reserve(
        reservation.warehouseId,
        reservation.ingredientId,
        -reservation.reservedQuantity,
      );
    }
    item.status = 'cancelled';
    item.cancelReason = reason;
    const saved = await this.orderItemsRepository.save(item);
    await this.recalculateTotals(item.orderId);
    return saved;
  }

  // ------------------------------------------------------- order item addons

  async listItemAddons(orderItemId: number): Promise<OrderItemAddon[]> {
    await this.findItem(orderItemId);
    return this.orderItemAddonsRepository.find({ where: { orderItemId } });
  }

  async addItemAddon(
    orderItemId: number,
    dto: CreateOrderItemAddonDto,
    options: {
      order?: Order;
      deferTotals?: boolean;
      deferReservations?: boolean;
    } = {},
  ): Promise<OrderItemAddon> {
    const item = await this.findItem(orderItemId);
    const order = options.order ?? (await this.findOne(item.orderId));
    await this.operatingHoursService.assertOperational(order.outletId);
    OrdersService.assertMutable(order);
    const addon = await this.addonsService.findOne(dto.addonId);

    const quantity = dto.quantity ?? 1;
    const saved = await this.orderItemAddonsRepository.save(
      this.orderItemAddonsRepository.create({
        orderItemId,
        addonId: addon.id,
        quantity,
        unitPrice: addon.price,
        totalAmount: round2(quantity * addon.price),
      }),
    );

    if (!options.deferTotals) await this.recalculateTotals(item.orderId);
    // recalculateReservations is a *full* recompute of the item, not a delta,
    // so a batch caller adding several addons to the same item gets an
    // identical result from one pass afterwards — the per-addon runs were
    // pure duplicated work (a transaction and a row lock each).
    if (options.deferReservations) return saved;
    try {
      await this.recalculateReservations(orderItemId, order);
    } catch (error) {
      await this.orderItemAddonsRepository.remove(saved);
      if (!options.deferTotals) await this.recalculateTotals(item.orderId);
      throw error;
    }
    return saved;
  }

  async removeItemAddon(orderItemId: number, addonId: number): Promise<void> {
    const item = await this.findItem(orderItemId);
    const order = await this.findOne(item.orderId);
    await this.operatingHoursService.assertOperational(order.outletId);
    OrdersService.assertMutable(order);
    await this.orderItemAddonsRepository.delete({ orderItemId, addonId });
    await this.recalculateTotals(item.orderId);
    await this.recalculateReservations(orderItemId);
  }

  // -------------------------------------------------------- ingredient reservations

  /** Read-only visibility into what an order item currently holds/consumed/released. */
  async listItemReservations(
    orderItemId: number,
  ): Promise<OrderItemIngredientReservation[]> {
    await this.findItem(orderItemId);
    return this.reservationsRepository.find({ where: { orderItemId } });
  }

  // --------------------------------------------------------------- payments

  /** Called by OrderPaymentsService after saving a new completed payment/refund row. */
  async recalculatePayments(orderId: number): Promise<void> {
    const order = await this.findOne(orderId);
    const payments = await this.orderPaymentsRepository.find({
      where: { orderId, status: 'completed' },
    });

    const totals = calculatePaymentTotals(order.grandTotal, payments);
    Object.assign(order, totals);

    await this.ordersRepository.save(order);
  }

  // --------------------------------------------------------------- loyalty

  /**
   * Redeems loyalty points against an order: the account-level min/balance
   * checks live in LoyaltyService.redeemPoints, while the max-redemption
   * cap (a percentage of the order's own grand total) is enforced here
   * since only this method knows that value.
   */
  async redeemLoyaltyPoints(
    orderId: number,
    points: number,
    userId: number,
  ): Promise<Order> {
    const order = await this.findOne(orderId);
    await this.operatingHoursService.assertOperational(order.outletId);
    OrdersService.assertMutable(order);
    if (!order.customerId) {
      throw new BadRequestException('Order has no customer to redeem points for');
    }

    const loyaltySettings = await this.settingsService.getLoyaltySettings();
    const pointsPerCurrencyUnit = Number(
      loyaltySettings.pointsPerCurrencyUnit ?? 0,
    );
    if (pointsPerCurrencyUnit <= 0) {
      throw new BadRequestException(
        'Loyalty redemption is not configured (pointsPerCurrencyUnit is 0)',
      );
    }
    const maxRedemptionPercent = Number(
      loyaltySettings.maxRedemptionPercent ?? 0,
    );
    const maxRedeemableValue = round2(
      (order.grandTotal * maxRedemptionPercent) / 100,
    );

    const discountAmount = round2(points / pointsPerCurrencyUnit);
    if (discountAmount > maxRedeemableValue) {
      throw new BadRequestException(
        `Redemption value ${discountAmount} exceeds the maximum redeemable value of ${maxRedeemableValue} for this order`,
      );
    }

    await this.loyaltyService.redeemPoints(
      order.customerId,
      points,
      orderId,
      userId,
    );

    order.loyaltyPointsRedeemed = points;
    order.loyaltyDiscountAmount = discountAmount;
    await this.ordersRepository.save(order);

    return this.recalculateTotals(orderId);
  }

  // ---------------------------------------------------------------- private

  /**
   * Subtotal computed fresh from the order's own persisted items/addons —
   * never from a client-supplied value — so discount/tax bound checks
   * (see update()) can't be defeated by a client asserting its own
   * "current subtotal" alongside the discount it wants applied.
   */
  private async computeBillableSubtotal(orderId: number): Promise<number> {
    const items = await this.orderItemsRepository.find({ where: { orderId } });
    // Voided/cancelled items (see voidItem) must not keep billing the
    // customer — only items still actually on the order count toward the
    // total.
    const billableItems = items.filter((item) => item.status !== 'cancelled');
    const itemIds = billableItems.map((item) => item.id);

    const itemsTotal = billableItems.reduce(
      (sum, item) => sum + item.totalAmount,
      0,
    );
    const addons = itemIds.length
      ? await this.orderItemAddonsRepository.find({
          where: { orderItemId: In(itemIds) },
        })
      : [];
    const addonsTotal = addons.reduce(
      (sum, addon) => sum + addon.totalAmount,
      0,
    );

    return round2(itemsTotal + addonsTotal);
  }

  private async recalculateTotals(orderId: number): Promise<Order> {
    const order = await this.findOne(orderId);
    const subtotal = await this.computeBillableSubtotal(orderId);
    const discountAmount =
      order.discountType === 'flat'
        ? order.discountValue
        : order.discountType === 'percentage'
          ? round2((subtotal * order.discountValue) / 100)
          : 0;
    const grandTotal = round2(
      subtotal - discountAmount - order.loyaltyDiscountAmount,
    );

    order.subtotal = subtotal;
    order.discountAmount = discountAmount;
    order.grandTotal = grandTotal;

    // Re-read payment totals from the immutable ledger instead of trusting
    // the denormalized paidAmount snapshot. This prevents an item update that
    // recalculates the bill from overwriting a payment that was recorded at
    // nearly the same time.
    const payments = await this.orderPaymentsRepository.find({
      where: { orderId, status: 'completed' },
    });
    Object.assign(order, calculatePaymentTotals(grandTotal, payments));

    return this.ordersRepository.save(order);
  }

  private generateOrderNumber(outletId: number): string {
    return generateDocumentNumber('ORD', outletId);
  }

  /** Generate invoice for an order on-demand. Returns the order with invoiceNumber set. */
  async issueInvoice(orderId: number): Promise<Order> {
    const order = await this.findOne(orderId);
    await this.operatingHoursService.assertOperational(order.outletId);
    if (order.invoiceNumber) {
      throw new ConflictException(
        `Order ${orderId} already has an invoice: ${order.invoiceNumber}`,
      );
    }

    const invoiceNumber = await this.dataSource.transaction(async (manager) => {
      return this.generateInvoiceNumber(manager, order.outletId);
    });

    order.invoiceNumber = invoiceNumber;
    order.invoiceGeneratedAt = new Date();
    return this.ordersRepository.save(order);
  }

  private async nextInvoiceSequence(
    manager: EntityManager,
    outletId: number,
    periodKey: string,
  ): Promise<number> {
    this.logger.log(`[INV_SEQ] Querying invoice_number_counters for outlet=${outletId}, periodKey=${periodKey}`);
    const rows: { last_number: number }[] = await manager.query(
      `INSERT INTO invoice_number_counters (outlet_id, period_key, last_number, updated_at)
       VALUES ($1, $2, 1, now())
       ON CONFLICT (outlet_id, period_key)
       DO UPDATE SET last_number = invoice_number_counters.last_number + 1, updated_at = now()
       RETURNING last_number`,
      [outletId, periodKey],
    );
    const sequence = Number(rows[0].last_number);
    this.logger.log(`[INV_SEQ] Got sequence number: ${sequence} for outlet=${outletId}`);
    return sequence;
  }

  private async generateInvoiceNumber(
    manager: EntityManager,
    outletId: number,
  ): Promise<string> {
    try {
      const posSettings = await this.settingsService.getPosSettings();
      const prefix = (posSettings.invoicePrefix as string) || 'INV';
      const digits = Number(posSettings.invoiceNumberDigits ?? 4);
      const resetPeriod = (posSettings.invoiceNumberResetPeriod as string) ?? 'daily';

      const now = new Date();
      let periodTag = '';
      if (resetPeriod === 'daily') {
        periodTag = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, '');
      } else if (resetPeriod === 'monthly') {
        periodTag = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .slice(0, 7)
          .replace('-', '');
      } else if (resetPeriod === 'yearly') {
        periodTag = String(now.getFullYear());
      }

      const sequence = await this.nextInvoiceSequence(manager, outletId, periodTag || 'all');
      const padded = String(sequence).padStart(digits, '0');
      return periodTag ? `${prefix}-${periodTag}-${padded}` : `${prefix}-${padded}`;
    } catch (error) {
      // Fallback to simple format if settings unavailable
      this.logger.warn(`[INV_GEN] Failed to fetch POS settings, using fallback format: ${(error as Error).message}`);
      const sequence = await this.nextInvoiceSequence(manager, outletId, 'all');
      return `INV-${sequence.toString().padStart(4, '0')}`;
    }
  }

  private async nextBillSequence(
    manager: EntityManager,
    outletId: number,
    periodKey: string,
  ): Promise<number> {
    this.logger.log(`[BILL_SEQ] Querying bill_number_counters for outlet=${outletId}, periodKey=${periodKey}`);
    const rows: { last_number: number }[] = await manager.query(
      `INSERT INTO bill_number_counters (outlet_id, period_key, last_number, updated_at)
       VALUES ($1, $2, 1, now())
       ON CONFLICT (outlet_id, period_key)
       DO UPDATE SET last_number = bill_number_counters.last_number + 1, updated_at = now()
       RETURNING last_number`,
      [outletId, periodKey],
    );
    const sequence = Number(rows[0].last_number);
    this.logger.log(`[BILL_SEQ] Got sequence number: ${sequence} for outlet=${outletId}`);
    return sequence;
  }

  private async generateBillNumber(
    manager: EntityManager,
    outletId: number,
  ): Promise<string> {
    const posSettings = await this.settingsService.getPosSettings();
    const prefix = (posSettings.receiptPrefix as string) || 'BILL';
    const digits = Number(posSettings.billNumberDigits ?? 4);
    const resetPeriod = (posSettings.billNumberResetPeriod as string) ?? 'daily';

    const now = new Date();
    let periodTag = '';
    if (resetPeriod === 'daily') {
      periodTag = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
    } else if (resetPeriod === 'monthly') {
      periodTag = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 7)
        .replace('-', '');
    } else if (resetPeriod === 'yearly') {
      periodTag = String(now.getFullYear());
    }

    const sequence = await this.nextBillSequence(manager, outletId, periodTag || 'all');
    const padded = String(sequence).padStart(digits, '0');
    return periodTag ? `${prefix}-${periodTag}-${padded}` : `${prefix}-${padded}`;
  }

  /** THE single authoritative order-insert path, used by create(), createFromGuest(), and openTableWithOrder(). Generates UUID billId and formatted billNumber. */
  private async insertOrderWithBillNumber(
    manager: EntityManager,
    outletId: number,
    buildOrder: (billId: string, billNumber: string | null) => Order,
  ): Promise<Order> {
    this.logger.log(`[INSERT_ORDER] Starting insertOrderWithBillNumber for outletId=${outletId}`);
    const billId = uuidv4();

    // Generate formatted bill number if POS settings are configured
    let billNumber: string | null = null;
    try {
      billNumber = await this.generateBillNumber(manager, outletId);
      this.logger.log(`[INSERT_ORDER] Generated billId=${billId}, billNumber=${billNumber} for outlet ${outletId}`);
    } catch (error) {
      this.logger.warn(`[INSERT_ORDER] Failed to generate formatted bill number, using NULL: ${(error as Error).message}`);
      this.logger.log(`[INSERT_ORDER] Generated billId=${billId} for outlet ${outletId}`);
    }

    const order = await manager.save(buildOrder(billId, billNumber));
    this.logger.log(`[INSERT_ORDER] Order ${order.id} inserted with billId=${billId}, billNumber=${billNumber} for outlet ${outletId}`);
    return order;
  }

  /**
   * Merges a kitchen food's food_recipes (variant-override rule,
   * scaled by item quantity) with every recipe-enabled addon's addon_recipes
   * (scaled by that addon's own quantity), converting every row into the
   * ingredient's base unit. Foods/addons without isRecipeEnabled contribute
   * nothing — zero behavior change for the vast majority of the menu.
   */
  /**
   * Resolves one recipe row's ingredient + unit-conversion in parallel with
   * every other row in the same list (each row's ingredient/unit lookup is
   * independent of the others — only the final Map merge has to stay
   * sequential), instead of one findOne+findConversionMultiplier pair per
   * row awaited in a for-loop. On a remote DB where every round trip costs
   * ~150-200ms even warm, a 3-ingredient recipe went from ~6 sequential
   * queries to 2 rounds run concurrently.
   */
  private async accumulateRecipeContributions(
    recipes: {
      ingredientId: number;
      unitId: number;
      quantity: number;
      wastageQuantity: number;
    }[],
    quantityMultiplier: number,
    required: Map<number, number>,
    ingredientById?: Map<number, any>,
    conversionMultiplierByPair?: Map<string, number>,
  ): Promise<void> {
    const ingredients =
      ingredientById ??
      new Map(
        (await this.ingredientsService.findByIds(
          [...new Set(recipes.map((recipe) => recipe.ingredientId))],
        )).map((ingredient) => [ingredient.id, ingredient]),
      );
    const conversions =
      conversionMultiplierByPair ??
      await this.unitsService.findConversionMultipliers(
        recipes
          .map((recipe) => ({
            fromUnitId: recipe.unitId,
            toUnitId: ingredients.get(recipe.ingredientId)?.baseUnitId ?? 0,
          }))
          .filter((pair) => pair.toUnitId !== 0),
      );

    for (const recipe of recipes) {
      const ingredient = ingredients.get(recipe.ingredientId);
      if (!ingredient || !isTrackableIngredientType(ingredient.category.type)) {
        continue;
      }

      const key = `${recipe.unitId}:${ingredient.baseUnitId}`;
      const multiplier = conversions.get(key);
      if (multiplier === undefined) {
        if (recipe.unitId === ingredient.baseUnitId) {
          // same-unit recipes are already normalized and still valid.
        } else {
          throw new BadRequestException(
            `No unit conversion configured from unit ${recipe.unitId} to unit ${ingredient.baseUnitId}`,
          );
        }
      }

      const effectiveMultiplier = multiplier ?? 1;
      const qty = round4(
        (recipe.quantity + recipe.wastageQuantity) *
          effectiveMultiplier *
          quantityMultiplier,
      );
      required.set(
        recipe.ingredientId,
        round4((required.get(recipe.ingredientId) ?? 0) + qty),
      );
    }
  }

  private async resolveRequiredIngredients(
    item: OrderItem,
    knownFood?: Food,
  ): Promise<Map<number, number>> {
    const required = new Map<number, number>();

    const [food, itemAddons] = await Promise.all([
      knownFood && knownFood.id === item.foodId ? Promise.resolve(knownFood) : this.foodsService.findOne(item.foodId),
      this.orderItemAddonsRepository.find({ where: { orderItemId: item.id } }),
    ]);

    const recipeGroups: Array<{
      recipes: {
        ingredientId: number;
        unitId: number;
        quantity: number;
        wastageQuantity: number;
      }[];
      quantityMultiplier: number;
    }> = [];

    if (food.itemType === 'kitchen') {
      recipeGroups.push({
        recipes: await this.foodsService.resolveRecipes(item.foodId, item.foodVariantId),
        quantityMultiplier: item.quantity,
      });
    }

    const addonRecipeGroups = await Promise.all(
      itemAddons.map(async (itemAddon) => {
        const addon = await this.addonsService.findOne(itemAddon.addonId);
        if (!addon.isRecipeEnabled) {
          return null;
        }
        const recipes = await this.addonsService.resolveRecipes(addon.id);
        return {
          recipes: recipes.map((recipe) => ({
            ingredientId: recipe.ingredientId,
            unitId: recipe.unitId,
            quantity: recipe.quantity * itemAddon.quantity,
            wastageQuantity: recipe.wastageQuantity * itemAddon.quantity,
          })),
          quantityMultiplier: 1,
        };
      }),
    );

    for (const group of addonRecipeGroups) {
      if (group) recipeGroups.push(group);
    }

    if (recipeGroups.length === 0) {
      return required;
    }

    const flattened = recipeGroups.flatMap((group) =>
      group.recipes.map((recipe) => ({
        ingredientId: recipe.ingredientId,
        unitId: recipe.unitId,
        quantity: recipe.quantity * group.quantityMultiplier,
        wastageQuantity: recipe.wastageQuantity * group.quantityMultiplier,
      })),
    );

    const ingredientIds = [...new Set(flattened.map((recipe) => recipe.ingredientId))];
    const ingredients = await this.ingredientsService.findByIds(ingredientIds);
    const ingredientById = new Map(
      ingredients.map((ingredient) => [ingredient.id, ingredient]),
    );
    const conversions = await this.unitsService.findConversionMultipliers(
      flattened.map((recipe) => ({
        fromUnitId: recipe.unitId,
        toUnitId: ingredientById.get(recipe.ingredientId)?.baseUnitId ?? 0,
      })).filter((pair) => pair.toUnitId !== 0),
    );

    await this.accumulateRecipeContributions(
      flattened,
      1,
      required,
      ingredientById,
      conversions,
    );

    return required;
  }

  /**
   * Batched version of recalculateReservations() for a whole cart.
   * One transaction covers the whole set of newly-added items, and every
   * stock delta is applied across the group instead of re-running the
   * same per-item flow in a loop.
   */
  private async recalculateReservationsBatch(
    order: Order,
    items: OrderItem[],
    foodById: Map<number, Food>,
    sharedManager?: EntityManager,
  ): Promise<void> {
    if (items.length === 0) return;

    const itemIds = items.map((item) => item.id);
    const [allAddons, allExisting, warehouse] = await Promise.all([
      this.orderItemAddonsRepository.find({
        where: { orderItemId: In(itemIds) },
      }),
      this.reservationsRepository.find({
        where: { orderItemId: In(itemIds), status: 'reserved' },
      }),
      this.warehousesService.findDefaultForOutlet(order.outletId),
    ]);

    const addonsByItemId = new Map<number, OrderItemAddon[]>();
    for (const addon of allAddons) {
      const existing = addonsByItemId.get(addon.orderItemId) ?? [];
      existing.push(addon);
      addonsByItemId.set(addon.orderItemId, existing);
    }

    const existingByItemId = new Map<number, OrderItemIngredientReservation[]>();
    for (const reservation of allExisting) {
      const existing = existingByItemId.get(reservation.orderItemId) ?? [];
      existing.push(reservation);
      existingByItemId.set(reservation.orderItemId, existing);
    }

    const requiredByItemId = new Map<number, Map<number, number>>();
    await Promise.all(
      items.map(async (item) => {
        const required = new Map<number, number>();
        const food = foodById.get(item.foodId);
        if (food?.itemType === 'kitchen') {
          const recipes = await this.foodsService.resolveRecipes(
            item.foodId,
            item.foodVariantId,
          );
          await this.accumulateRecipeContributions(
            recipes,
            item.quantity,
            required,
          );
        }

        const addonRecipeGroups = await Promise.all(
          (addonsByItemId.get(item.id) ?? []).map(async (itemAddon) => {
            const addon = await this.addonsService.findOne(itemAddon.addonId);
            if (!addon.isRecipeEnabled) {
              return { recipes: [], quantity: itemAddon.quantity };
            }
            const recipes = await this.addonsService.resolveRecipes(addon.id);
            return { recipes, quantity: itemAddon.quantity };
          }),
        );

        for (const { recipes, quantity } of addonRecipeGroups) {
          if (recipes.length === 0) continue;
          await this.accumulateRecipeContributions(
            recipes,
            quantity,
            required,
          );
        }

        requiredByItemId.set(item.id, required);
      }),
    );

    const apply = async (manager: EntityManager) => {
      const reservationRepo = manager.getRepository(
        OrderItemIngredientReservation,
      );

      for (const item of items) {
        const required = requiredByItemId.get(item.id) ?? new Map();
        const existing = existingByItemId.get(item.id) ?? [];
        const existingByIngredient = new Map(
          existing.map((reservation) => [reservation.ingredientId, reservation]),
        );

        for (const reservation of existing) {
          if (!required.has(reservation.ingredientId)) {
            await this.warehouseIngredientStocksService.reserve(
              reservation.warehouseId,
              reservation.ingredientId,
              -reservation.reservedQuantity,
              manager,
            );
            await reservationRepo.remove(reservation);
          }
        }

        for (const [ingredientId, requiredQty] of required) {
          const existingReservation = existingByIngredient.get(ingredientId);
          const currentReserved = existingReservation?.reservedQuantity ?? 0;
          const delta = round4(requiredQty - currentReserved);

          if (delta !== 0) {
            await this.warehouseIngredientStocksService.reserve(
              warehouse.id,
              ingredientId,
              delta,
              manager,
            );
          }

          if (existingReservation) {
            existingReservation.reservedQuantity = requiredQty;
            await reservationRepo.save(existingReservation);
          } else if (requiredQty > 0) {
            await reservationRepo.save(
              reservationRepo.create({
                orderItemId: item.id,
                warehouseId: warehouse.id,
                ingredientId,
                reservedQuantity: requiredQty,
                consumedQuantity: 0,
                wastageQuantity: 0,
                status: 'reserved',
              }),
            );
          }
        }
      }
    };

    if (sharedManager) {
      await apply(sharedManager);
      return;
    }
    await this.dataSource.transaction(apply);
  }

  /**
   * Full recompute (not an incremental delta) of an order item's ingredient
   * reservations — called after anything that changes what it needs (item
   * add/quantity-update, addon add/remove). Diffs the freshly-resolved
   * requirement against existing `reserved` rows and adjusts
   * `reservedQuantity` by the delta per ingredient; a positive delta can
   * throw (insufficient available stock).
   */
  private async recalculateReservations(
    orderItemId: number,
    knownOrder?: Order,
    knownFood?: Food,
    sharedManager?: EntityManager,
    knownItem?: OrderItem,
  ): Promise<void> {
    const item = knownItem ?? (await this.findItem(orderItemId));
    const required = await this.resolveRequiredIngredients(item, knownFood);

    const existing = await this.reservationsRepository.find({
      where: { orderItemId, status: 'reserved' },
    });
    if (required.size === 0 && existing.length === 0) {
      // Nothing to reserve and nothing previously reserved — skip entirely,
      // so foods/addons without isRecipeEnabled never require a default
      // warehouse to be configured for the order's outlet.
      return;
    }

    // Reuse the caller's already-loaded order when available (addItem always
    // has one) instead of re-fetching the same row — one fewer round trip on
    // this DB's remote pooler (~150-200ms even warm) per item added.
    const order =
      knownOrder && knownOrder.id === item.orderId ? knownOrder : await this.findOne(item.orderId);
    const warehouse = await this.warehousesService.findDefaultForOutlet(
      order.outletId,
    );
    const existingByIngredient = new Map(
      existing.map((reservation) => [reservation.ingredientId, reservation]),
    );

    // A caller adding a whole cart passes its own manager so every item's
    // diff lands in one transaction: each `reserve()` takes a FOR UPDATE row
    // lock, and on this DB's remote pooler a transaction per item (plus one
    // per addon) was the single largest cost in placing an order.
    const apply = async (manager: EntityManager) => {
      const reservationRepo = manager.getRepository(
        OrderItemIngredientReservation,
      );

      for (const reservation of existing) {
        if (!required.has(reservation.ingredientId)) {
          await this.warehouseIngredientStocksService.reserve(
            reservation.warehouseId,
            reservation.ingredientId,
            -reservation.reservedQuantity,
            manager,
          );
          await reservationRepo.remove(reservation);
        }
      }

      for (const [ingredientId, requiredQty] of required) {
        const existingReservation = existingByIngredient.get(ingredientId);
        const currentReserved = existingReservation?.reservedQuantity ?? 0;
        const delta = round4(requiredQty - currentReserved);

        if (delta !== 0) {
          await this.warehouseIngredientStocksService.reserve(
            warehouse.id,
            ingredientId,
            delta,
            manager,
          );
        }

        if (existingReservation) {
          existingReservation.reservedQuantity = requiredQty;
          await reservationRepo.save(existingReservation);
        } else if (requiredQty > 0) {
          await reservationRepo.save(
            reservationRepo.create({
              orderItemId,
              warehouseId: warehouse.id,
              ingredientId,
              reservedQuantity: requiredQty,
              consumedQuantity: 0,
              wastageQuantity: 0,
              status: 'reserved',
            }),
          );
        }
      }
    };

    if (sharedManager) {
      await apply(sharedManager);
      return;
    }
    await this.dataSource.transaction(apply);
  }

  /**
   * All still-`reserved` rows across every item on this order, in one
   * batched pair of queries (item ids, then reservations for those ids)
   * instead of one query-per-item — used by both consumeReservationsForOrder
   * and releaseReservationsForOrder, which previously re-fetched the same
   * way per item.
   */
  private async findReservedForOrder(
    orderId: number,
  ): Promise<OrderItemIngredientReservation[]> {
    const items = await this.orderItemsRepository.find({
      where: { orderId },
    });
    if (items.length === 0) return [];
    return this.reservationsRepository.find({
      where: {
        orderItemId: In(items.map((item) => item.id)),
        status: 'reserved',
      },
    });
  }

  /**
   * On order completion: every reserved row posts sale_consume and becomes
   * consumed — all in one transaction (was one dataSource.transaction() per
   * reservation, each paying its own BEGIN/COMMIT round trip on top of the
   * reserve+applyMovement+save queries).
   */
  private async consumeReservationsForOrder(
    orderId: number,
    changedBy: number,
  ): Promise<void> {
    const reservations = await this.findReservedForOrder(orderId);
    if (reservations.length === 0) return;
    await this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(
        OrderItemIngredientReservation,
      );
      for (const reservation of reservations) {
        await this.warehouseIngredientStocksService.reserve(
          reservation.warehouseId,
          reservation.ingredientId,
          -reservation.reservedQuantity,
          manager,
        );
        await this.warehouseIngredientStocksService.applyMovement({
          warehouseId: reservation.warehouseId,
          ingredientId: reservation.ingredientId,
          quantityDelta: -reservation.reservedQuantity,
          transactionType: 'sale_consume',
          referenceType: 'order_item',
          referenceId: reservation.orderItemId,
          createdBy: changedBy,
          manager,
        });
        reservation.consumedQuantity = reservation.reservedQuantity;
        reservation.status = 'consumed';
        await reservationRepo.save(reservation);
      }
    });
  }

  /**
   * On order cancellation: every reserved row releases with no ledger effect
   * — same single-transaction batching as consumeReservationsForOrder.
   */
  private async releaseReservationsForOrder(orderId: number): Promise<void> {
    const reservations = await this.findReservedForOrder(orderId);
    if (reservations.length === 0) return;
    await this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(
        OrderItemIngredientReservation,
      );
      for (const reservation of reservations) {
        await this.warehouseIngredientStocksService.reserve(
          reservation.warehouseId,
          reservation.ingredientId,
          -reservation.reservedQuantity,
          manager,
        );
        reservation.status = 'released';
        await reservationRepo.save(reservation);
      }
    });
  }
}
