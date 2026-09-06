import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { OutletDepartment } from '../outlet-departments/entities/outlet-department.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrdersService } from '../orders/orders.service';
import { PermissionsService } from '../auth/permissions.service';
import { User } from '../users/entities/user.entity';
import {
  KdsBootstrapResponseDto,
  KitchenTicketItemResponseDto,
  KitchenTicketResponseDto,
} from './dto/kitchen-ticket-response.dto';
import { ListKitchenTicketsQueryDto } from './dto/list-kitchen-tickets-query.dto';
import { KitchenTicketItem } from './entities/kitchen-ticket-item.entity';
import type { KitchenTicketItemStatus } from './entities/kitchen-ticket-item.entity';
import { KitchenTicket } from './entities/kitchen-ticket.entity';
import type { KitchenTicketPriority } from './entities/kitchen-ticket.entity';
import { KitchenTicketsGateway } from './kitchen-tickets.gateway';

export interface KdsBootstrapResponse {
  stations: OutletDepartment[];
  tickets: KitchenTicket[];
}

/**
 * Item lifecycle plus "cancelled" reachable from any non-terminal state —
 * mirrors OrderItem's own status field (see orders.service.ts), which this
 * service keeps in sync.
 */
const ITEM_STATUS_TRANSITIONS: Record<
  KitchenTicketItemStatus,
  KitchenTicketItemStatus[]
> = {
  sent_to_kitchen: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: [],
  cancelled: [],
};

const TICKET_DISPLAY_RELATIONS = [
  'order',
  'order.tableSession',
  'order.tableSession.diningTable',
  'department',
  'items',
  'items.orderItem',
  'items.orderItem.food',
  'items.orderItem.foodVariant',
];

@Injectable()
export class KitchenTicketsService {
  constructor(
    @InjectRepository(KitchenTicket)
    private readonly ticketsRepository: Repository<KitchenTicket>,
    @InjectRepository(KitchenTicketItem)
    private readonly ticketItemsRepository: Repository<KitchenTicketItem>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(OutletDepartment)
    private readonly departmentsRepository: Repository<OutletDepartment>,
    private readonly dataSource: DataSource,
    private readonly gateway: KitchenTicketsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly permissionsService: PermissionsService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  async findAll(
    query: ListKitchenTicketsQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
    assignedDepartmentIds: number[] | null = null,
  ): Promise<PaginatedResponse<KitchenTicketResponseDto>> {
    const { page, limit, outletId, orderId, departmentId, status } = query;
    const where: FindOptionsWhere<KitchenTicket> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    } else if (accessibleOutletIds !== 'ALL') {
      where.outletId = In(accessibleOutletIds);
    }
    if (orderId !== undefined) {
      where.orderId = orderId;
    }
    if (departmentId !== undefined) {
      where.departmentId = departmentId;
    }
    if (assignedDepartmentIds !== null) {
      where.departmentId = In(assignedDepartmentIds);
    }
    if (status !== undefined) {
      where.status = status;
    }

    const [tickets, total] = await this.ticketsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: tickets.map((ticket) => this.toResponse(ticket)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup — returns the raw entity, used by other methods in this service that need to mutate it. */
  async findOne(id: number): Promise<KitchenTicket> {
    const ticket = await this.ticketsRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Kitchen ticket ${id} not found`);
    }
    return ticket;
  }

  /** Controller-facing GET :id — same lookup as findOne(), mapped to the response DTO. */
  async findOneResponse(id: number): Promise<KitchenTicketResponseDto> {
    return this.toResponse(await this.findOne(id));
  }

  async listItems(ticketId: number): Promise<KitchenTicketItemResponseDto[]> {
    await this.findOne(ticketId);
    const items = await this.ticketItemsRepository.find({ where: { ticketId } });
    return items.map((item) => this.toItemResponse(item));
  }

  /** KDS screen bootstrap: stations for the outlet + its open/in-progress tickets, fully hydrated for display. */
  async getKdsBootstrap(
    outletId: number,
    user: User,
  ): Promise<KdsBootstrapResponseDto> {
    const restrictToAssignedDepartments =
      !user.isSuperadmin && (await this.permissionsService.isKitchenStaff(user.id));
    const assignedDepartmentIds = restrictToAssignedDepartments
      ? await this.permissionsService.getEmployeeDepartmentIds(user.id, outletId)
      : null;

    // Kitchen staff must be isolated at the API boundary. The frontend also
    // filters its tabs for UX, but it must not be the security boundary.
    const [stations, tickets] = await Promise.all([
      assignedDepartmentIds !== null && assignedDepartmentIds.length === 0
        ? Promise.resolve([])
        : this.departmentsRepository.find({
            where: {
              outletId,
              canPrepareOrder: true,
              ...(assignedDepartmentIds !== null
                ? { id: In(assignedDepartmentIds) }
                : {}),
            },
            order: { name: 'ASC' },
          }),
      this.ticketsRepository.find({
        where: {
          outletId,
          status: In(['open', 'in_progress']),
          ...(assignedDepartmentIds !== null
            ? { departmentId: In(assignedDepartmentIds) }
            : {}),
        },
        relations: TICKET_DISPLAY_RELATIONS,
        order: { priority: 'DESC', createdAt: 'ASC' },
      }),
    ]);

    return {
      stations: stations.map((station) => ({
        id: station.id,
        name: station.name,
        type: station.type,
        canPrepareOrder: station.canPrepareOrder,
      })),
      tickets: tickets.map((ticket) => this.toResponse(ticket)),
    };
  }

  async updateItemStatus(
    ticketId: number,
    itemId: number,
    status: KitchenTicketItemStatus,
  ): Promise<KitchenTicket> {
    const ticket = await this.findOne(ticketId);
    const item = await this.ticketItemsRepository.findOne({
      where: { id: itemId, ticketId },
    });
    if (!item) {
      throw new NotFoundException(
        `Kitchen ticket item ${itemId} not found on ticket ${ticketId}`,
      );
    }

    const allowed = ITEM_STATUS_TRANSITIONS[item.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot move kitchen ticket item from "${item.status}" to "${status}"`,
      );
    }

    const now = new Date();
    item.status = status;
    if (status === 'preparing') item.startedAt = now;
    if (status === 'ready') item.readyAt = now;
    if (status === 'served') item.servedAt = now;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(KitchenTicketItem).save(item);
      await manager.getRepository(OrderItem).update(
        { id: item.orderItemId },
        { status },
      );
    });

    const updatedTicket = await this.recomputeTicketStatus(ticket.id);
    if (status === 'ready') {
      await this.notifyItemsReady(ticket.id, [item.id]);
    }
    if (status === 'served') {
      await this.ordersService.maybeAdvanceToServed(ticket.orderId, null);
    }
    this.gateway.notifyTicketUpdated(updatedTicket);
    this.gateway.notifyItemUpdated(updatedTicket.outletId, item);
    return updatedTicket;
  }

  async updatePriority(
    ticketId: number,
    priority: KitchenTicketPriority,
  ): Promise<KitchenTicket> {
    const ticket = await this.findOne(ticketId);
    ticket.priority = priority;
    const saved = await this.ticketsRepository.save(ticket);
    this.gateway.notifyTicketUpdated(saved);
    return saved;
  }

  /** Cancels every still-open ticket for an order — called when the order itself is cancelled (staff or guest), so the kitchen doesn't keep working on food nobody's paying for. Reuses cancelTicket() per ticket rather than duplicating its item/notification logic. */
  async cancelAllForOrder(orderId: number): Promise<void> {
    const tickets = await this.ticketsRepository.find({
      where: { orderId, status: In(['open', 'in_progress']) },
    });
    for (const ticket of tickets) {
      await this.cancelTicket(ticket.id);
    }
  }

  async cancelTicket(ticketId: number): Promise<KitchenTicket> {
    const ticket = await this.findOne(ticketId);
    const items = await this.ticketItemsRepository.find({
      where: { ticketId },
    });

    const cancellable = items.filter((item) =>
      ITEM_STATUS_TRANSITIONS[item.status].includes('cancelled'),
    );
    for (const item of cancellable) {
      item.status = 'cancelled';
    }
    if (cancellable.length > 0) {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(KitchenTicketItem).save(cancellable);
        await manager.getRepository(OrderItem).update(
          { id: In(cancellable.map((item) => item.orderItemId)) },
          { status: 'cancelled' },
        );
      });
    }

    ticket.status = 'cancelled';
    const saved = await this.ticketsRepository.save(ticket);
    this.gateway.notifyTicketUpdated(saved);
    await this.notifySimple(
      saved,
      'kitchen_cancelled',
      'Kitchen ticket cancelled',
    );
    return saved;
  }

  /**
   * Ticket-level "Start": bulk-moves every 'sent_to_kitchen' item to
   * 'preparing' (and mirrors the change onto OrderItem.status). This is the
   * one-tap version of the per-item action for a whole ticket.
   */
  async startTicket(ticketId: number): Promise<KitchenTicket> {
    return this.transitionItems(ticketId, ['sent_to_kitchen'], 'preparing');
  }

  /**
   * Ticket-level "Mark Ready": bulk-moves every 'sent_to_kitchen'/'preparing'
   * item to 'ready'. A fast kitchen may skip Start and go straight here, so
   * both upstream states are eligible.
   */
  async markTicketReady(ticketId: number): Promise<KitchenTicket> {
    return this.transitionItems(
      ticketId,
      ['sent_to_kitchen', 'preparing'],
      'ready',
    );
  }

  /**
   * Ticket-level "Mark Served": bulk-moves every 'ready' item to 'served'
   * (handoff to the waitstaff — the ticket then reads all-terminal and drops
   * off the KDS board).
   */
  async markTicketServed(ticketId: number): Promise<KitchenTicket> {
    return this.transitionItems(ticketId, ['ready'], 'served');
  }

  /**
   * Shared bulk transition: moves every item in `fromStatuses` to `toStatus`,
   * keeps OrderItem.status in sync, recomputes the aggregate ticket status and
   * pushes one ticket update + one item update per affected item so both the
   * KDS board and POS screens refresh in realtime.
   */
  private async transitionItems(
    ticketId: number,
    fromStatuses: KitchenTicketItemStatus[],
    toStatus: Exclude<KitchenTicketItemStatus, 'sent_to_kitchen'>,
  ): Promise<KitchenTicket> {
    const ticket = await this.findOne(ticketId);
    const items = await this.ticketItemsRepository.find({
      where: { ticketId },
    });
    const eligible = items.filter((item) => fromStatuses.includes(item.status));
    if (eligible.length === 0) {
      throw new BadRequestException(
        `No items on ticket ${ticketId} eligible to move to "${toStatus}"`,
      );
    }

    const now = new Date();
    for (const item of eligible) {
      item.status = toStatus;
      if (toStatus === 'preparing') item.startedAt = now;
      if (toStatus === 'ready') item.readyAt = now;
      if (toStatus === 'served') item.servedAt = now;
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(KitchenTicketItem).save(eligible);
      await manager.getRepository(OrderItem).update(
        { id: In(eligible.map((item) => item.orderItemId)) },
        { status: toStatus },
      );
    });

    const updatedTicket = await this.recomputeTicketStatus(ticketId);
    if (toStatus === 'ready') {
      await this.notifyItemsReady(
        ticketId,
        eligible.map((item) => item.id),
      );
    }
    if (toStatus === 'served') {
      await this.ordersService.maybeAdvanceToServed(ticket.orderId, null);
    }
    this.gateway.notifyTicketUpdated(updatedTicket);
    for (const item of eligible) {
      this.gateway.notifyItemUpdated(updatedTicket.outletId, item);
    }
    return updatedTicket;
  }

  async recallItem(ticketId: number, itemId: number): Promise<KitchenTicket> {
    const item = await this.ticketItemsRepository.findOne({
      where: { id: itemId, ticketId },
    });
    if (!item) {
      throw new NotFoundException(
        `Kitchen ticket item ${itemId} not found on ticket ${ticketId}`,
      );
    }
    if (item.status !== 'ready' && item.status !== 'served') {
      throw new BadRequestException(
        `Only "ready" or "served" items can be recalled (item is "${item.status}")`,
      );
    }

    const now = new Date();
    item.status = 'preparing';
    item.readyAt = null;
    item.servedAt = null;
    item.recalledAt = now;
    item.recallCount += 1;
    const ticket = await this.findOne(ticketId);
    ticket.recalledAt = now;
    ticket.recallCount += 1;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(KitchenTicketItem).save(item);
      await manager.getRepository(OrderItem).update(
        { id: item.orderItemId },
        { status: 'preparing' },
      );
      await manager.getRepository(KitchenTicket).save(ticket);
    });

    const updatedTicket = await this.recomputeTicketStatus(ticketId);
    this.gateway.notifyTicketUpdated(updatedTicket);
    this.gateway.notifyItemUpdated(updatedTicket.outletId, item);
    await this.notifySimple(
      updatedTicket,
      'kitchen_recalled',
      'Kitchen ticket recalled',
    );
    return updatedTicket;
  }

  /** Recomputes a ticket's aggregate status/timers from its items' statuses. */
  private async recomputeTicketStatus(
    ticketId: number,
  ): Promise<KitchenTicket> {
    const ticket = await this.findOne(ticketId);
    const items = await this.ticketItemsRepository.find({
      where: { ticketId },
    });

    const now = new Date();
    const allTerminal = items.every(
      (item) => item.status === 'served' || item.status === 'cancelled',
    );
    const allCancelled = items.every((item) => item.status === 'cancelled');
    const anyActive = items.some(
      (item) => item.status === 'preparing' || item.status === 'ready',
    );

    if (allTerminal) {
      ticket.status = allCancelled ? 'cancelled' : 'completed';
      ticket.servedAt ??= now;
    } else if (anyActive) {
      ticket.status = 'in_progress';
      ticket.startedAt ??= now;
    } else {
      ticket.status = 'open';
    }

    const saved = await this.ticketsRepository.save(ticket);
    // Single choke point for every item-level mutation (single/bulk
    // transition, recall, mark-delivered): first walks Order.status forward
    // to match how far its items have collectively progressed (item status
    // itself is untouched — see syncStatusFromItems), then pushes the
    // current order to the guest tracker room (a no-op unless this order
    // actually has a customer of record, i.e. is a guest order).
    await this.ordersService.syncStatusFromItems(saved.orderId, null);
    await this.ordersService.notifyGuestByOrderId(saved.orderId);
    return saved;
  }

  /** Called by OrdersService.sendToKitchen() after creating tickets in its own transaction. */
  notifyTicketsCreated(tickets: KitchenTicket[]): void {
    this.gateway.notifyTicketsCreated(tickets);
  }

  /**
   * "Mark Delivered": bulk-moves every 'ready' item across all of an order's
   * kitchen tickets to 'served' (the waitstaff handoff). Keeps OrderItem.status
   * in sync, recomputes each affected ticket and pushes the updates so the
   * ready queue clears in realtime.
   */
  async markOrderReadyItemsServed(orderId: number): Promise<KitchenTicket[]> {
    const eligible = await this.ticketItemsRepository
      .createQueryBuilder('ticketItem')
      .innerJoin('ticketItem.ticket', 'ticket')
      .where('ticket.order_id = :orderId', { orderId })
      .andWhere('ticketItem.status = :status', { status: 'ready' })
      .getMany();
    if (eligible.length === 0) {
      throw new BadRequestException(
        `No ready items on order ${orderId} to mark as served`,
      );
    }

    const now = new Date();
    for (const item of eligible) {
      item.status = 'served';
      item.servedAt = now;
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(KitchenTicketItem).save(eligible);
      await manager.getRepository(OrderItem).update(
        { id: In(eligible.map((item) => item.orderItemId)) },
        { status: 'served' },
      );
    });

    const ticketIds = [...new Set(eligible.map((item) => item.ticketId))];
    const tickets: KitchenTicket[] = [];
    for (const ticketId of ticketIds) {
      const updated = await this.recomputeTicketStatus(ticketId);
      this.gateway.notifyTicketUpdated(updated);
      for (const item of eligible.filter((i) => i.ticketId === ticketId)) {
        this.gateway.notifyItemUpdated(updated.outletId, item);
      }
      tickets.push(updated);
    }
    await this.ordersService.maybeAdvanceToServed(orderId, null);
    return tickets;
  }

  /** Marks exactly one ready kitchen item as delivered by the waitstaff. */
  async markOrderReadyItemServed(
    orderId: number,
    ticketItemId: number,
  ): Promise<KitchenTicket> {
    const item = await this.ticketItemsRepository
      .createQueryBuilder('ticketItem')
      .innerJoinAndSelect('ticketItem.ticket', 'ticket')
      .where('ticketItem.id = :ticketItemId', { ticketItemId })
      .andWhere('ticket.order_id = :orderId', { orderId })
      .getOne();

    if (!item) {
      throw new NotFoundException(
        `Ready item ${ticketItemId} was not found on order ${orderId}`,
      );
    }
    if (item.status !== 'ready') {
      throw new BadRequestException(
        `Item ${ticketItemId} is not ready to be delivered (status: ${item.status})`,
      );
    }

    const now = new Date();
    item.status = 'served';
    item.servedAt = now;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(KitchenTicketItem).save(item);
      await manager.getRepository(OrderItem).update(
        { id: item.orderItemId },
        { status: 'served' },
      );
    });

    const ticket = await this.recomputeTicketStatus(item.ticketId);
    this.gateway.notifyTicketUpdated(ticket);
    this.gateway.notifyItemUpdated(ticket.outletId, item);
    await this.ordersService.maybeAdvanceToServed(orderId, null);
    return ticket;
  }

  /**
   * Persists + pushes a "Table X — items ready" notification so the POS bell
   * and the waiter service queue pick it up without polling.
   */
  /** Public so OrdersService can push the same "items ready" waiter alert for ready-made items that skip the kitchen entirely (see sendItemsToKitchen). */
  async notifyItemsReady(
    ticketId: number,
    itemIds: number[],
  ): Promise<void> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
      relations: [
        'order',
        'order.tableSession',
        'order.tableSession.diningTable',
      ],
    });
    if (!ticket) {
      return;
    }
    const items = await this.ticketItemsRepository.find({
      where: { id: In(itemIds) },
      relations: ['orderItem', 'orderItem.food'],
    });

    const tableName =
      ticket.order?.tableSession?.diningTable?.name ?? 'Takeaway';
    const names = items.map(
      (item) =>
        `${item.orderItem?.food?.name ?? 'Item'} ×${item.orderItem?.quantity ?? 1}`,
    );
    const summary = names.slice(0, 3).join(', ');
    const body =
      names.length > 3 ? `${summary} +${names.length - 3} more` : summary;

    const notification = await this.notificationsService.create({
      outletId: ticket.outletId,
      type: 'kitchen_ready',
      title: `${tableName} — items ready`,
      body,
      tableName,
      orderId: ticket.orderId,
      data: JSON.stringify({ itemCount: names.length, ticketId }),
    });
    this.gateway.notifyNotificationCreated(notification);
  }

  /** Small persist+push helper for the recall/cancel notifications above. */
  private async notifySimple(
    ticket: KitchenTicket,
    type: 'kitchen_recalled' | 'kitchen_cancelled',
    title: string,
  ): Promise<void> {
    const notification = await this.notificationsService.create({
      outletId: ticket.outletId,
      type,
      priority: 'high',
      title,
      orderId: ticket.orderId,
      data: JSON.stringify({ ticketId: ticket.id }),
    });
    this.gateway.notifyNotificationCreated(notification);
  }

  /**
   * Called on a repeatable interval by KitchenDelayScanProcessor (see
   * kitchen-tickets.module.ts). Flags open/in-progress tickets that have sat
   * without going "ready" past the threshold — one notification per ticket,
   * deduped against the last scan window so it doesn't re-fire every run.
   */
  async scanForDelayedTickets(thresholdMinutes = 15): Promise<number> {
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);
    const stale = await this.ticketsRepository
      .createQueryBuilder('ticket')
      .where('ticket.status IN (:...statuses)', {
        statuses: ['open', 'in_progress'],
      })
      .andWhere('ticket.created_at <= :cutoff', { cutoff })
      .getMany();

    let notified = 0;
    for (const ticket of stale) {
      const marker = `"ticketId":${ticket.id}`;
      const alreadyNotified = await this.notificationsService.existsRecent(
        ticket.outletId,
        'kitchen_delayed',
        marker,
        thresholdMinutes,
      );
      if (alreadyNotified) {
        continue;
      }
      const notification = await this.notificationsService.create({
        outletId: ticket.outletId,
        type: 'kitchen_delayed',
        priority: 'urgent',
        title: `Kitchen ticket #${ticket.id} is running late`,
        body: `Open for over ${thresholdMinutes} minutes with no items ready yet.`,
        orderId: ticket.orderId,
        data: JSON.stringify({ ticketId: ticket.id }),
      });
      this.gateway.notifyNotificationCreated(notification);
      notified += 1;
    }
    return notified;
  }

  // ---------------------------------------------------------------- mapping

  /**
   * Public (not private) so both this service's own controller-facing
   * methods and KitchenTicketsController itself (for the handful of
   * mutation endpoints that return whatever entity their service method
   * already produced) can map to the wire shape — mirrors UsersService's
   * toResponse() convention. Nested order/department/items only populate
   * when the source query actually loaded those relations (currently just
   * getKdsBootstrap's TICKET_DISPLAY_RELATIONS) — safe to leave undefined
   * otherwise, matching the DTO's optional fields.
   */
  toResponse(ticket: KitchenTicket): KitchenTicketResponseDto {
    return {
      id: ticket.id,
      orderId: ticket.orderId,
      outletId: ticket.outletId,
      departmentId: ticket.departmentId,
      status: ticket.status,
      priority: ticket.priority,
      startedAt: ticket.startedAt,
      readyAt: ticket.readyAt,
      servedAt: ticket.servedAt,
      recalledAt: ticket.recalledAt,
      recallCount: ticket.recallCount,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      department: ticket.department
        ? { id: ticket.department.id, name: ticket.department.name }
        : ticket.department,
      items: ticket.items?.map((item) => this.toItemResponse(item)),
      order: ticket.order
        ? {
          id: ticket.order.id,
          orderNumber: ticket.order.orderNumber,
          createdAt: ticket.order.createdAt,
            tableSession: ticket.order.tableSession
              ? {
                  id: ticket.order.tableSession.id,
                  diningTable: ticket.order.tableSession.diningTable
                    ? {
                        id: ticket.order.tableSession.diningTable.id,
                        name: ticket.order.tableSession.diningTable.name,
                      }
                    : undefined,
                }
              : ticket.order.tableSession,
          }
        : undefined,
    };
  }

  toItemResponse(item: KitchenTicketItem): KitchenTicketItemResponseDto {
    return {
      id: item.id,
      ticketId: item.ticketId,
      orderItemId: item.orderItemId,
      status: item.status,
      startedAt: item.startedAt,
      readyAt: item.readyAt,
      servedAt: item.servedAt,
      recalledAt: item.recalledAt,
      recallCount: item.recallCount,
      orderItem: item.orderItem
        ? {
            id: item.orderItem.id,
            foodId: item.orderItem.foodId,
            foodVariantId: item.orderItem.foodVariantId,
            quantity: item.orderItem.quantity,
            unitPrice: item.orderItem.unitPrice,
            totalAmount: item.orderItem.totalAmount,
            note: item.orderItem.note,
            food: item.orderItem.food
              ? { id: item.orderItem.food.id, name: item.orderItem.food.name }
              : undefined,
            foodVariant: item.orderItem.foodVariant
              ? { id: item.orderItem.foodVariant.id, name: item.orderItem.foodVariant.name }
              : item.orderItem.foodVariant,
          }
        : undefined,
    };
  }
}
