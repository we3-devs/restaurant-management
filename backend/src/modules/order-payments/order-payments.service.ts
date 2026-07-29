import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { ListOrderPaymentsQueryDto } from './dto/list-order-payments-query.dto';
import { OrderPayment } from './entities/order-payment.entity';

@Injectable()
export class OrderPaymentsService {
  constructor(
    @InjectRepository(OrderPayment)
    private readonly orderPaymentsRepository: Repository<OrderPayment>,
    private readonly ordersService: OrdersService,
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

    return saved;
  }

  private generatePaymentNumber(outletId: number): string {
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `PAY-${outletId}-${Date.now()}-${random}`;
  }
}
