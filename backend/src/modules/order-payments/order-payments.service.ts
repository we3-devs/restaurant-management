import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import type { Order } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
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
    const order = await this.ordersService.findOne(orderId);
    OrdersService.assertMutable(order);

    const payment = this.orderPaymentsRepository.create({
      outletId: order.outletId,
      orderId,
      receivedBy,
      paymentNumber: this.generatePaymentNumber(order.outletId),
      type: dto.type ?? 'payment',
      method: dto.method ?? 'cash',
      provider: dto.provider ?? null,
      transactionReference: dto.transactionReference ?? null,
      amount: dto.amount,
      status: 'completed',
      paidAt: new Date(),
      note: dto.note ?? null,
    });
    const saved = await this.orderPaymentsRepository.save(payment);

    await this.ordersService.recalculatePayments(orderId);

    if (saved.status === 'completed' && saved.type === 'payment') {
      const notification = await this.notificationsService.create({
        outletId: order.outletId,
        type: 'payment_received',
        title: `Payment received — ${order.orderNumber}`,
        body: `${saved.method} · ${saved.amount}`,
        orderId,
        actorUserId: receivedBy,
        data: JSON.stringify({ paymentId: saved.id }),
      });
      this.gateway.notifyNotificationCreated(notification);
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
