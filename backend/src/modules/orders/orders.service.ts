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
  Not,
  Repository,
} from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { AddonsService } from '../addons/addons.service';
import { CustomersService } from '../customers/customers.service';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { CreateTableSessionDto } from '../table-sessions/dto/create-table-session.dto';
import { OpenTableSessionDto } from '../table-sessions/dto/open-table-session.dto';
import { TableSession } from '../table-sessions/entities/table-session.entity';
import { FoodVariantsService } from '../food-variants/food-variants.service';
import { FoodsService } from '../foods/foods.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { WarehouseIngredientStocksService } from '../inventory-stock/warehouse-ingredient-stocks.service';
import { KitchenTicketItem } from '../kitchen-tickets/entities/kitchen-ticket-item.entity';
import { KitchenTicket } from '../kitchen-tickets/entities/kitchen-ticket.entity';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { KitchenTicketsService } from '../kitchen-tickets/kitchen-tickets.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OutletDepartmentsService } from '../outlet-departments/outlet-departments.service';
import { OutletsService } from '../outlets/outlets.service';
import { OrderPayment } from '../order-payments/entities/order-payment.entity';
import { ReservationsService } from '../reservations/reservations.service';
import { SettingsService } from '../settings/settings.service';
import { TableSessionsService } from '../table-sessions/table-sessions.service';
import { UnitsService } from '../units/units.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateOrderItemAddonDto } from './dto/create-order-item-addon.dto';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrderItemsQueryDto } from './dto/list-order-items-query.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderItemAddon } from './entities/order-item-addon.entity';
import { OrderItemIngredientReservation } from './entities/order-item-ingredient-reservation.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import type { OrderStatus } from './entities/order.entity';

export interface OrderItemWithRelations extends OrderItem {
  addons: OrderItemAddon[];
  reservations: OrderItemIngredientReservation[];
}

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
  ) {}

  // ---------------------------------------------------------------- orders

  async findAll(query: ListOrdersQueryDto): Promise<PaginatedResponse<Order>> {
    const { page, limit, search, outletId, tableSessionId, status } = query;
    const where: FindOptionsWhere<Order> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    }
    if (tableSessionId !== undefined) {
      where.tableSessionId = tableSessionId;
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (search) {
      where.orderNumber = ILike(`%${search}%`);
    }

    const [orders, total] = await this.ordersRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: orders,
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
   * The happy-path stage the order's active (non-cancelled) items have
   * collectively reached, or null if there's nothing to derive yet (every
   * item is still 'stock_reserved' — not sent to kitchen). Item status
   * itself is untouched here; this only reads it.
   */
  private deriveOrderStageFromItems(items: OrderItem[]): OrderStatus | null {
    const statuses = new Set(items.map((item) => item.status));
    if (statuses.size === 0) return null;
    if (statuses.size === 1 && statuses.has('served')) return 'served';
    if (statuses.has('served')) return 'partially_served';
    if (statuses.size === 1 && statuses.has('ready')) return 'ready';
    if (statuses.has('ready')) return 'partially_ready';
    if (statuses.has('preparing')) return 'preparing';
    if (statuses.has('sent_to_kitchen')) return 'accepted';
    return null;
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
   * Called by KitchenTicketsService after any item-level change. Order.status
   * only otherwise moves on an explicit staff PATCH or via
   * maybeAdvanceToServed — nothing walks it through preparing/partially-ready/
   * ready as tickets progress (see the ORDER_STATUS_TRANSITIONS comment).
   * This closes that gap: sent (accepted) -> preparing -> (partially_ready
   * or ready) -> (partially_served or served), taking only the direct hops
   * the items actually support (via findStatusPath), each one going through
   * the normal updateStatus() path so history/notifications/realtime push
   * all fire exactly as they would for a staff-driven change. Deliberately
   * never moves it backward (e.g. after a recalled item) — findStatusPath
   * returns [] when `to` is behind `from`, since the graph has no backward
   * edges — and never touches cancelled/completed orders or item status
   * itself.
   */
  async syncStatusFromItems(
    orderId: number,
    changedBy: number | null,
  ): Promise<void> {
    const order = await this.findOne(orderId);
    if (order.status === 'cancelled' || order.status === 'completed') return;

    const items = await this.orderItemsRepository.find({ where: { orderId } });
    const active = items.filter((item) => item.status !== 'cancelled');
    const target = this.deriveOrderStageFromItems(active);
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

    return this.dataSource.transaction((manager) =>
      this.insertOrderWithBillNumber(manager, dto.outletId, (billNumber) =>
        manager.create(Order, {
          outletId: dto.outletId,
          tableSessionId: dto.tableSessionId ?? null,
          customerId: dto.customerId ?? null,
          reservationId: dto.reservationId ?? null,
          orderType: dto.orderType ?? 'table',
          note: dto.note ?? null,
          orderNumber: this.generateOrderNumber(dto.outletId),
          billNumber,
          createdBy,
        }),
      ),
    );
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
        (billNumber) =>
          queryRunner.manager.create(Order, {
            outletId: dto.outletId,
            tableSessionId: session.id,
            customerId: dto.customerId ?? null,
            reservationId: dto.reservationId ?? null,
            orderType: dto.orderType ?? 'table',
            note: dto.note ?? null,
            orderNumber: this.generateOrderNumber(dto.outletId),
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
    customerId: number,
    items: CreateOrderItemDto[],
    diningTableId: number,
    tableName: string,
  ): Promise<Order> {
    const existing = (
      await this.findOpenForTableSession(tableSessionId)
    ).find((order) => order.status !== 'completed');

    const saved =
      existing ??
      (await this.dataSource.transaction((manager) =>
        this.insertOrderWithBillNumber(manager, outletId, (billNumber) =>
          manager.create(Order, {
            outletId,
            tableSessionId,
            customerId,
            orderType: 'table',
            orderNumber: this.generateOrderNumber(outletId),
            createdBy: null,
            source: 'online',
            orderSource: 'qr',
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

    for (const item of items) {
      await this.addItem(saved.id, item);
    }

    // Guests have no staff actor to drive this — reuses the exact same
    // kitchen-send path staff use via POST /orders/:id/send-to-kitchen, so a
    // guest order reaches the kitchen the moment it's placed instead of
    // sitting invisibly until a staff member notices and sends it manually.
    await this.sendToKitchen(saved.id, null);

    const notification = await this.notificationsService.create({
      outletId,
      type: 'guest_order_placed',
      title: existing ? 'Guest Order Updated' : 'New Guest Order',
      body: `${tableName} ${existing ? 'added items to their order' : 'placed a new order'}`,
      orderId: saved.id,
      tableName,
      data: JSON.stringify({ tableSessionId, diningTableId, customerId }),
    });
    this.gateway.notifyNotificationCreated(notification);

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
  ): Promise<(Order & { items: OrderItemWithRelations[] })[]> {
    const orders = await this.ordersRepository.find({
      where: { tableSessionId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return Promise.all(
      orders.map(async (order) => {
        // Loads food/foodVariant here (unlike the staff order-detail flow,
        // which looks names up client-side from an already-loaded foods
        // list) — the guest item tracker has no such list mounted, so the
        // name has to travel with the item.
        const items = await this.orderItemsRepository.find({
          where: { orderId: order.id },
          relations: ['food', 'foodVariant'],
          order: { createdAt: 'ASC' },
        });
        return { ...order, items: await this.attachItemRelations(items) };
      }),
    );
  }

  async update(id: number, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    OrdersService.assertMutable(order);

    Object.assign(order, {
      ...(dto.note !== undefined && { note: dto.note }),
      ...(dto.discountType !== undefined && { discountType: dto.discountType }),
      ...(dto.discountValue !== undefined && {
        discountValue: dto.discountValue,
      }),
      ...(dto.taxAmount !== undefined && { taxAmount: dto.taxAmount }),
      ...(dto.serviceChargeAmount !== undefined && {
        serviceChargeAmount: dto.serviceChargeAmount,
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
    const fromStatus = order.status;

    if (
      dto.status !== fromStatus &&
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
      const notification = await this.notificationsService.create({
        outletId: saved.outletId,
        type: 'order_cancelled',
        priority: 'high',
        title: `Order ${saved.orderNumber} cancelled`,
        body: dto.cancelReason ?? null,
        orderId: saved.id,
        actorUserId: changedBy,
      });
      this.gateway.notifyNotificationCreated(notification);
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
  ): Promise<KitchenTicket[]> {
    const order = await this.findOne(orderId);
    OrdersService.assertMutable(order);
    const items = await this.orderItemsRepository.find({
      where: { orderId, status: 'stock_reserved' },
    });
    const eligible = items.filter((item) => !item.isHeld);
    if (eligible.length === 0) {
      throw new BadRequestException(
        items.some((item) => item.isHeld)
          ? 'Every pending item is held — fire the held items to send them'
          : 'No items to send to kitchen',
      );
    }
    return this.sendItemsToKitchen(order, eligible, changedBy);
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
          for (const item of groupItems) {
            const ticketItem = await ticketItemRepo.save(
              ticketItemRepo.create({
                ticketId: ticket.id,
                orderItemId: item.id,
                status: 'ready',
                startedAt: now,
                readyAt: now,
              }),
            );
            itemIds.push(ticketItem.id);
            item.status = 'ready';
            await itemRepo.save(item);
          }
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
        for (const item of groupItems) {
          await ticketItemRepo.save(
            ticketItemRepo.create({
              ticketId: ticket.id,
              orderItemId: item.id,
              status: 'sent_to_kitchen',
            }),
          );
          item.status = 'sent_to_kitchen';
          await itemRepo.save(item);
        }
        createdTickets.push(ticket);
      }
      return { createdTickets, readyMade };
    });

    if (order.status === 'pending') {
      await this.updateStatus(order.id, { status: 'accepted' }, changedBy);
    }
    await this.maybeAdvanceToServed(order.id, changedBy);

    const { createdTickets: tickets, readyMade } = ticketResult;
    const kitchenBound = tickets.filter((t) => t.departmentId !== null);
    if (kitchenBound.length > 0) {
      this.kitchenTicketsService.notifyTicketsCreated(kitchenBound);
    }
    for (const { ticketId, itemIds } of readyMade) {
      await this.kitchenTicketsService.notifyItemsReady(ticketId, itemIds);
    }
    const notification = await this.notificationsService.create({
      outletId: order.outletId,
      type: 'order_sent',
      title: `Order ${order.orderNumber} sent to kitchen`,
      orderId: order.id,
      actorUserId: changedBy,
      data: JSON.stringify({ ticketCount: tickets.length }),
    });
    this.gateway.notifyNotificationCreated(notification);
    return tickets;
  }

  /**
   * Every non-cancelled OrderItem on the order is 'served' → auto-advance
   * Order.status to 'served' if it isn't already there or terminal. Called
   * whenever an item transitions to 'served' via kitchen-ticket progress
   * (including a waiter delivering a ready-made item off the ready queue).
   */
  async maybeAdvanceToServed(
    orderId: number,
    changedBy: number | null,
  ): Promise<void> {
    const items = await this.orderItemsRepository.find({
      where: { orderId },
    });
    const relevant = items.filter((item) => item.status !== 'cancelled');
    if (
      relevant.length === 0 ||
      !relevant.every((item) => item.status === 'served')
    ) {
      return;
    }

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
  ): Promise<PaginatedResponse<OrderItemWithRelations>> {
    const { page, limit, orderId } = query;
    const where: FindOptionsWhere<OrderItem> = {};
    if (orderId !== undefined) {
      where.orderId = orderId;
    }

    const [items, total] = await this.orderItemsRepository.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: await this.attachItemRelations(items),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
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
   * outlet.
   */
  private async resolvePreparationDepartmentId(
    outletId: number,
    foodId: number,
  ): Promise<number | null> {
    const food = await this.foodsService.findOne(foodId);
    if (!food.departmentType) {
      return null;
    }
    const departments =
      await this.outletDepartmentsService.findByOutlet(outletId);
    const match = departments.find(
      (d) => d.type === food.departmentType && d.canPrepareOrder,
    );
    return match?.id ?? null;
  }

  async addItem(orderId: number, dto: CreateOrderItemDto): Promise<OrderItem> {
    const order = await this.findOne(orderId);
    OrdersService.assertMutable(order);

    const preparationDepartmentId = await this.resolvePreparationDepartmentId(
      order.outletId,
      dto.foodId,
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
      const { price } = await this.foodsService.resolvePriceForOutlet(
        dto.foodId,
        order.outletId,
      );
      unitPrice = price;
    }

    const quantity = dto.quantity ?? 1;
    const item = this.orderItemsRepository.create({
      orderId,
      foodId: dto.foodId,
      foodVariantId: dto.foodVariantId ?? null,
      preparationDepartmentId,
      quantity,
      unitPrice,
      totalAmount: round2(quantity * unitPrice),
      note: dto.note ?? null,
    });
    const saved = await this.orderItemsRepository.save(item);

    await this.recalculateTotals(orderId);
    try {
      await this.recalculateReservations(saved.id);
    } catch (error) {
      // Roll back the item — its ingredient requirement couldn't be reserved.
      await this.orderItemsRepository.remove(saved);
      await this.recalculateTotals(orderId);
      throw error;
    }
    return saved;
  }

  async updateItem(id: number, dto: UpdateOrderItemDto): Promise<OrderItem> {
    const item = await this.findItem(id);
    OrdersService.assertMutable(await this.findOne(item.orderId));
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

  async removeItem(id: number): Promise<void> {
    const item = await this.findItem(id);
    OrdersService.assertMutable(await this.findOne(item.orderId));
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

  // ------------------------------------------------------- order item addons

  async listItemAddons(orderItemId: number): Promise<OrderItemAddon[]> {
    await this.findItem(orderItemId);
    return this.orderItemAddonsRepository.find({ where: { orderItemId } });
  }

  async addItemAddon(
    orderItemId: number,
    dto: CreateOrderItemAddonDto,
  ): Promise<OrderItemAddon> {
    const item = await this.findItem(orderItemId);
    OrdersService.assertMutable(await this.findOne(item.orderId));
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

    await this.recalculateTotals(item.orderId);
    try {
      await this.recalculateReservations(orderItemId);
    } catch (error) {
      await this.orderItemAddonsRepository.remove(saved);
      await this.recalculateTotals(item.orderId);
      throw error;
    }
    return saved;
  }

  async removeItemAddon(orderItemId: number, addonId: number): Promise<void> {
    const item = await this.findItem(orderItemId);
    OrdersService.assertMutable(await this.findOne(item.orderId));
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

    const paidAmount = round2(
      payments
        .filter((p) => p.type === 'payment')
        .reduce((sum, p) => sum + p.amount, 0),
    );
    const refundedAmount = round2(
      payments
        .filter((p) => p.type === 'refund')
        .reduce((sum, p) => sum + p.amount, 0),
    );

    order.paidAmount = paidAmount;
    order.refundedAmount = refundedAmount;
    order.dueAmount = Math.max(round2(order.grandTotal - paidAmount), 0);

    if (refundedAmount > 0 && refundedAmount >= paidAmount) {
      order.paymentStatus = 'refunded';
    } else if (paidAmount <= 0) {
      order.paymentStatus = 'unpaid';
    } else if (paidAmount >= order.grandTotal) {
      order.paymentStatus = 'paid';
    } else {
      order.paymentStatus = 'partial';
    }

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

  private async recalculateTotals(orderId: number): Promise<Order> {
    const order = await this.findOne(orderId);
    const items = await this.orderItemsRepository.find({ where: { orderId } });
    const itemIds = items.map((item) => item.id);

    const itemsTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const addons = itemIds.length
      ? await this.orderItemAddonsRepository.find({
          where: { orderItemId: In(itemIds) },
        })
      : [];
    const addonsTotal = addons.reduce(
      (sum, addon) => sum + addon.totalAmount,
      0,
    );

    const subtotal = round2(itemsTotal + addonsTotal);
    const discountAmount =
      order.discountType === 'flat'
        ? order.discountValue
        : order.discountType === 'percentage'
          ? round2((subtotal * order.discountValue) / 100)
          : 0;
    const grandTotal = round2(
      subtotal -
        discountAmount -
        order.loyaltyDiscountAmount +
        order.taxAmount +
        order.serviceChargeAmount,
    );

    order.subtotal = subtotal;
    order.discountAmount = discountAmount;
    order.grandTotal = grandTotal;
    order.dueAmount = Math.max(round2(grandTotal - order.paidAmount), 0);

    return this.ordersRepository.save(order);
  }

  private generateOrderNumber(outletId: number): string {
    return generateDocumentNumber('ORD', outletId);
  }

  /**
   * The (outletId, periodKey) row's next sequence value, via a single
   * atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` against
   * bill_number_counters (see migration CreateBillNumberCounters). Postgres
   * serializes concurrent callers on the row itself — there is no
   * read-then-write gap for two requests to race through, unlike the
   * `orders.count()` approach this replaces. Must run against the same
   * transactional `manager` that will insert the order (see
   * insertOrderWithBillNumber) so the increment rolls back together with a
   * failed insert instead of burning a sequence number.
   */
  private async nextBillSequence(
    manager: EntityManager,
    outletId: number,
    periodKey: string,
  ): Promise<number> {
    const rows: { last_number: number }[] = await manager.query(
      `INSERT INTO bill_number_counters (outlet_id, period_key, last_number, updated_at)
       VALUES ($1, $2, 1, now())
       ON CONFLICT (outlet_id, period_key)
       DO UPDATE SET last_number = bill_number_counters.last_number + 1, updated_at = now()
       RETURNING last_number`,
      [outletId, periodKey],
    );
    return Number(rows[0].last_number);
  }

  /**
   * The guest-facing bill number — distinct from orderNumber (an internal
   * reference, never meant to be read by a guest). Format comes from the
   * "pos" settings category: {receiptPrefix}-[{periodTag}-]{sequence padded
   * to billNumberDigits}, e.g. BILL-20260803-0007. `periodKey` is the
   * counter row's key: the same as periodTag when the reset period resets
   * the visible number too (daily/monthly/yearly), or a fixed 'all' when
   * resetPeriod is 'never' (no periodTag, one counter per outlet forever).
   * Only ever called from insertOrderWithBillNumber — see that method's
   * comment for why this must never be called standalone.
   */
  private async generateBillNumber(
    manager: EntityManager,
    outletId: number,
  ): Promise<string> {
    const posSettings = await this.settingsService.getPosSettings();
    const prefix = (posSettings.receiptPrefix as string) || 'INV';
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

    const sequence = await this.nextBillSequence(
      manager,
      outletId,
      periodTag || 'all',
    );
    const padded = String(sequence).padStart(digits, '0');
    return periodTag ? `${prefix}-${periodTag}-${padded}` : `${prefix}-${padded}`;
  }

  /**
   * THE single authoritative order-insert path. Every flow that creates an
   * order — staff POS (create()), guest self-ordering (createFromGuest()),
   * and "open a table + its first order" (openTableWithOrder()) — must
   * route its insert through this method rather than calling
   * generateBillNumber()/manager.save(Order, ...) directly. Centralizing
   * this is deliberate: a previous incident shipped openTableWithOrder()
   * with its own hand-rolled bill-number/insert logic that had no retry at
   * all, which is exactly the kind of regression this method exists to make
   * impossible — there is nowhere else in the codebase a caller can get an
   * Order row into the database without going through here (verified: grep
   * for `manager.create(Order` / `ordersRepository.create(` across
   * backend/src turns up only the three call sites above, all routed
   * through this method).
   *
   * Generates a bill number and inserts `buildOrder(billNumber)` inside the
   * given transactional `manager`, retrying up to 3 times on a Postgres
   * unique_violation (23505) against orders_bill_number_key. The atomic
   * counter in generateBillNumber already makes same-instance collisions
   * effectively impossible, but this stays as defensive-in-depth (e.g. a
   * bill_number hand-edited elsewhere). Each attempt is wrapped in a
   * SAVEPOINT so a failed insert only unwinds that attempt — not the whole
   * transaction (e.g. openTableWithOrder's session insert that already
   * landed earlier in the same transaction).
   */
  private async insertOrderWithBillNumber(
    manager: EntityManager,
    outletId: number,
    buildOrder: (billNumber: string) => Order,
  ): Promise<Order> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await manager.query('SAVEPOINT bill_number_attempt');
      try {
        const billNumber = await this.generateBillNumber(manager, outletId);
        const order = await manager.save(buildOrder(billNumber));
        await manager.query('RELEASE SAVEPOINT bill_number_attempt');
        this.logger.debug(
          `insertOrderWithBillNumber: order ${order.id} inserted with bill_number=${billNumber} (outlet ${outletId}, attempt ${attempt}/3)`,
        );
        return order;
      } catch (error) {
        await manager.query('ROLLBACK TO SAVEPOINT bill_number_attempt');
        const isBillNumberCollision =
          (error as { code?: string })?.code === '23505' &&
          (error as { constraint?: string })?.constraint ===
            'orders_bill_number_key';
        if (!isBillNumberCollision || attempt === 3) throw error;
        this.logger.warn(
          `insertOrderWithBillNumber: bill_number collision on attempt ${attempt}/3 for outlet ${outletId}, retrying — ${(error as Error).message}`,
        );
      }
    }
    throw new Error('Failed to generate a unique bill number after 3 attempts');
  }

  /**
   * Merges a recipe-enabled food's food_recipes (variant-override rule,
   * scaled by item quantity) with every recipe-enabled addon's addon_recipes
   * (scaled by that addon's own quantity), converting every row into the
   * ingredient's base unit. Foods/addons without isRecipeEnabled contribute
   * nothing — zero behavior change for the vast majority of the menu.
   */
  private async resolveRequiredIngredients(
    item: OrderItem,
  ): Promise<Map<number, number>> {
    const required = new Map<number, number>();

    const food = await this.foodsService.findOne(item.foodId);
    if (food.isRecipeEnabled) {
      const recipes = await this.foodsService.resolveRecipes(
        item.foodId,
        item.foodVariantId,
      );
      for (const recipe of recipes) {
        const ingredient = await this.ingredientsService.findOne(
          recipe.ingredientId,
        );
        const multiplier = await this.unitsService.findConversionMultiplier(
          recipe.unitId,
          ingredient.baseUnitId,
        );
        const qty = round4(
          (recipe.quantity + recipe.wastageQuantity) *
            multiplier *
            item.quantity,
        );
        required.set(
          recipe.ingredientId,
          round4((required.get(recipe.ingredientId) ?? 0) + qty),
        );
      }
    }

    const itemAddons = await this.orderItemAddonsRepository.find({
      where: { orderItemId: item.id },
    });
    for (const itemAddon of itemAddons) {
      const addon = await this.addonsService.findOne(itemAddon.addonId);
      if (!addon.isRecipeEnabled) {
        continue;
      }
      const recipes = await this.addonsService.resolveRecipes(addon.id);
      for (const recipe of recipes) {
        const ingredient = await this.ingredientsService.findOne(
          recipe.ingredientId,
        );
        const multiplier = await this.unitsService.findConversionMultiplier(
          recipe.unitId,
          ingredient.baseUnitId,
        );
        const qty = round4(
          (recipe.quantity + recipe.wastageQuantity) *
            multiplier *
            itemAddon.quantity,
        );
        required.set(
          recipe.ingredientId,
          round4((required.get(recipe.ingredientId) ?? 0) + qty),
        );
      }
    }

    return required;
  }

  /**
   * Full recompute (not an incremental delta) of an order item's ingredient
   * reservations — called after anything that changes what it needs (item
   * add/quantity-update, addon add/remove). Diffs the freshly-resolved
   * requirement against existing `reserved` rows and adjusts
   * `reservedQuantity` by the delta per ingredient; a positive delta can
   * throw (insufficient available stock).
   */
  private async recalculateReservations(orderItemId: number): Promise<void> {
    const item = await this.findItem(orderItemId);
    const required = await this.resolveRequiredIngredients(item);

    const existing = await this.reservationsRepository.find({
      where: { orderItemId, status: 'reserved' },
    });
    if (required.size === 0 && existing.length === 0) {
      // Nothing to reserve and nothing previously reserved — skip entirely,
      // so foods/addons without isRecipeEnabled never require a default
      // warehouse to be configured for the order's outlet.
      return;
    }

    const order = await this.findOne(item.orderId);
    const warehouse = await this.warehousesService.findDefaultForOutlet(
      order.outletId,
    );
    const existingByIngredient = new Map(
      existing.map((reservation) => [reservation.ingredientId, reservation]),
    );

    await this.dataSource.transaction(async (manager) => {
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
    });
  }

  /** On order completion: every reserved row posts sale_consume and becomes consumed. */
  private async consumeReservationsForOrder(
    orderId: number,
    changedBy: number,
  ): Promise<void> {
    const items = await this.orderItemsRepository.find({
      where: { orderId },
    });
    for (const item of items) {
      const reservations = await this.reservationsRepository.find({
        where: { orderItemId: item.id, status: 'reserved' },
      });
      for (const reservation of reservations) {
        await this.dataSource.transaction(async (manager) => {
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
        });
        reservation.consumedQuantity = reservation.reservedQuantity;
        reservation.status = 'consumed';
        await this.reservationsRepository.save(reservation);
      }
    }
  }

  /** On order cancellation: every reserved row releases with no ledger effect. */
  private async releaseReservationsForOrder(orderId: number): Promise<void> {
    const items = await this.orderItemsRepository.find({
      where: { orderId },
    });
    for (const item of items) {
      const reservations = await this.reservationsRepository.find({
        where: { orderItemId: item.id, status: 'reserved' },
      });
      for (const reservation of reservations) {
        await this.warehouseIngredientStocksService.reserve(
          reservation.warehouseId,
          reservation.ingredientId,
          -reservation.reservedQuantity,
        );
        reservation.status = 'released';
        await this.reservationsRepository.save(reservation);
      }
    }
  }
}
