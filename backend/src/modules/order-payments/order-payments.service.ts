import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { CustomerCreditService } from '../customer-credit/customer-credit.service';
import { CustomersService } from '../customers/customers.service';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { OperatingHoursService } from '../operating-hours/operating-hours.service';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { CreateTableSessionPaymentDto } from './dto/create-table-session-payment.dto';
import { ListOrderPaymentsQueryDto } from './dto/list-order-payments-query.dto';
import { OrderPayment } from './entities/order-payment.entity';

@Injectable()
export class OrderPaymentsService {
  constructor(
    @InjectRepository(OrderPayment)
    private readonly orderPaymentsRepository: Repository<OrderPayment>,
    private readonly ordersService: OrdersService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
    private readonly dataSource: DataSource,
    private readonly customersService: CustomersService,
    private readonly customerCreditService: CustomerCreditService,
    private readonly settingsService: SettingsService,
    private readonly operatingHoursService: OperatingHoursService,
  ) {}

  async findAll(
    query: ListOrderPaymentsQueryDto,
  ): Promise<PaginatedResponse<OrderPayment>> {
    const { page, limit, orderId } = query;
    const where: FindOptionsWhere<OrderPayment> = {};
    if (orderId !== undefined) {
      where.orderId = orderId;
    }

    const [payments, total] = await this.orderPaymentsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: payments,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: number): Promise<OrderPayment> {
    const payment = await this.orderPaymentsRepository.findOne({
      where: { id },
    });
    if (!payment) {
      throw new NotFoundException(`Order payment ${id} not found`);
    }
    return payment;
  }

  async create(
    orderId: number,
    dto: CreateOrderPaymentDto,
    receivedBy: number,
  ): Promise<OrderPayment> {
    const targetOrder = await this.ordersService.findOne(orderId);
    await this.operatingHoursService.assertOperational(targetOrder.outletId);
    const type = dto.type ?? 'payment';
    const method = dto.method ?? 'cash';

    if (method === 'credit') {
      if (type !== 'payment') {
        throw new BadRequestException(
          "Credit is only supported for payments — settle a customer's balance via POST /customer-credit/settlements instead of a refund.",
        );
      }
      if (!dto.customerId) {
        throw new BadRequestException('customerId is required when method="credit"');
      }
      // Fails fast, before the order is locked/mutated, if the customer doesn't exist.
      await this.customersService.findOne(dto.customerId);

      // Enforce the customer's credit limit (0/unset = no limit) — without
      // this, chargeCredit() below only fires an over-limit notification
      // after the fact instead of actually stopping the charge.
      const account = await this.customerCreditService.getAccountByCustomer(
        dto.customerId,
      );
      if (account.creditLimit > 0) {
        const available = account.creditLimit - account.outstandingBalance;
        if (dto.amount > available) {
          throw new BadRequestException(
            `Charge amount (${dto.amount}) exceeds the customer's remaining credit (${Math.max(available, 0)} of ${account.creditLimit} limit)`,
          );
        }
      }
    }

    // Row-locks the order for the duration of the check + insert so a
    // concurrent payment/refund on the same order can't read the same
    // stale due/paid figure between the bound check below and the write —
    // recalculatePayments() runs after commit, once this new row is
    // actually visible to it.
    const { order, saved } = await this.dataSource.transaction(
      async (manager) => {
        const lockedOrder = await manager
          .createQueryBuilder(Order, 'order')
          .setLock('pessimistic_write')
          .where('order.id = :orderId', { orderId })
          .getOne();
        if (!lockedOrder) {
          throw new NotFoundException(`Order ${orderId} not found`);
        }
        OrdersService.assertMutable(lockedOrder);

        if (type === 'payment' && dto.amount > lockedOrder.dueAmount) {
          throw new BadRequestException(
            `Payment amount (${dto.amount}) exceeds the order's due amount (${lockedOrder.dueAmount})`,
          );
        }
        if (type === 'refund') {
          // paidAmount is already net of prior refunds (see
          // OrdersService.recalculatePayments), so it's also the correct
          // "still refundable" ceiling.
          if (lockedOrder.paidAmount <= 0) {
            throw new BadRequestException(
              'Cannot refund an order with no completed payments',
            );
          }
          if (dto.amount > lockedOrder.paidAmount) {
            throw new BadRequestException(
              `Refund amount (${dto.amount}) exceeds the order's net paid amount (${lockedOrder.paidAmount})`,
            );
          }
        }

        const payment = manager.create(OrderPayment, {
          outletId: lockedOrder.outletId,
          orderId,
          customerId: method === 'credit' ? dto.customerId! : null,
          receivedBy,
          paymentNumber: this.generatePaymentNumber(lockedOrder.outletId),
          type,
          method,
          provider: dto.provider ?? null,
          transactionReference: dto.transactionReference ?? null,
          amount: dto.amount,
          status: 'completed',
          paidAt: new Date(),
          note: dto.note ?? null,
        });
        const savedPayment = await manager.save(payment);
        return { order: lockedOrder, saved: savedPayment };
      },
    );

    await this.ordersService.recalculatePayments(orderId);

    if (saved.method === 'credit' && saved.customerId) {
      await this.customerCreditService.chargeCredit(saved.customerId, saved.amount, {
        orderId,
        userId: receivedBy,
        notes: `Order ${order.orderNumber}`,
      });
    }

    if (saved.status === 'completed' && saved.type === 'payment') {
      const notificationInput = {
        outletId: order.outletId,
        type: 'payment_received' as const,
        title: `Payment received — ${order.orderNumber}`,
        body: `${saved.method} · ${saved.amount}`,
        orderId,
        actorUserId: receivedBy,
        data: JSON.stringify({ paymentId: saved.id }),
      };

      if (saved.method === 'cash') {
        // Cash handling is sensitive (till counts, shortages) — scope
        // delivery to superadmins plus whichever roles are configured under
        // Settings > Notifications (default: manager, cashier).
        const { cashNotificationRoles } = await this.settingsService.getNotificationSettings();
        const roleSlugs = Array.isArray(cashNotificationRoles)
          ? (cashNotificationRoles as string[])
          : ['manager', 'cashier'];
        const recipientUserIds = await this.notificationsService.getUserIdsByRole(
          order.outletId,
          roleSlugs,
        );
        const notification = await this.notificationsService.create(
          notificationInput,
          recipientUserIds,
        );
        this.gateway.notifyUsersNotificationCreated(recipientUserIds, notification);
      } else {
        const notification = await this.notificationsService.create(notificationInput);
        this.gateway.notifyNotificationCreated(notification);
      }
    }

    return saved;
  }

  /**
   * One combined payment across a table session's open orders, oldest
   * first — settles the first (oldest) order's due amount before spilling
   * into the next, rather than staff paying off each order one at a time.
   * Reuses create() per order it touches, so each is still its own
   * immutable ledger row (no new "session payment" concept on the DB side).
   */
  async payForTableSession(
    tableSessionId: number,
    dto: CreateTableSessionPaymentDto,
    receivedBy: number,
  ): Promise<{ payments: OrderPayment[]; orders: Order[] }> {
    const openOrders = (
      await this.ordersService.findOpenForTableSession(tableSessionId)
    ).filter((order) => order.status !== 'completed' && order.dueAmount > 0);

    if (openOrders.length === 0) {
      throw new BadRequestException(
        `Table session ${tableSessionId} has no outstanding balance`,
      );
    }
    await this.operatingHoursService.assertOperational(openOrders[0].outletId);

    const totalDue = openOrders.reduce((sum, order) => sum + order.dueAmount, 0);
    if (dto.amount > totalDue) {
      throw new BadRequestException(
        `Amount ${dto.amount} exceeds the table's total due of ${totalDue}`,
      );
    }

    let remaining = dto.amount;
    const payments: OrderPayment[] = [];
    for (const order of openOrders) {
      if (remaining <= 0) break;
      const portion = Math.min(remaining, order.dueAmount);
      payments.push(
        await this.create(
          order.id,
          {
            type: 'payment',
            method: dto.method,
            amount: portion,
            note: dto.note,
            customerId: dto.customerId,
          },
          receivedBy,
        ),
      );
      remaining -= portion;
    }

    const orders = await Promise.all(
      openOrders.map((order) => this.ordersService.findOne(order.id)),
    );
    return { payments, orders };
  }

  private generatePaymentNumber(outletId: number): string {
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `PAY-${outletId}-${Date.now()}-${random}`;
  }
}
