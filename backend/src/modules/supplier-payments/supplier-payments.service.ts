import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { NotificationsService } from '../notifications/notifications.service';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { SuppliersService } from '../suppliers/suppliers.service';
import { SupplierPayment } from './entities/supplier-payment.entity';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { ListSupplierPaymentsQueryDto } from './dto/list-supplier-payments-query.dto';

@Injectable()
export class SupplierPaymentsService {
  private readonly logger = new Logger(SupplierPaymentsService.name);

  constructor(
    @InjectRepository(SupplierPayment) private readonly paymentRepo: Repository<SupplierPayment>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
    private readonly suppliersService: SuppliersService,
  ) {}

  async findAll(
    query: ListSupplierPaymentsQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<SupplierPayment>> {
    const { page, limit, search, supplierId, outletId, paymentMethod } = query;
    const where: FindOptionsWhere<SupplierPayment> = {};
    if (supplierId) where.supplierId = supplierId;
    if (outletId) where.outletId = outletId;
    else if (accessibleOutletIds !== 'ALL') where.outletId = In(accessibleOutletIds);
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (search) { where.paymentNo = ILike(`%${search}%`); }
    const [data, total] = await this.paymentRepo.findAndCount({ where, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async findOne(id: number): Promise<SupplierPayment> {
    const p = await this.paymentRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Supplier payment ${id} not found`);
    return p;
  }

  async create(dto: CreateSupplierPaymentDto, createdBy: number): Promise<SupplierPayment> {
    const payment = await this.paymentRepo.save(this.paymentRepo.create({
      ...dto, paymentNo: generateDocumentNumber('SP', dto.outletId), createdBy,
    }));

    await this.suppliersService.adjustOutstandingBalance(dto.supplierId, -dto.amount);

    // Fire-and-forget: the payment above is already committed, so a
    // notification hiccup shouldn't fail this otherwise-successful request.
    this.notificationsService
      .create({
        outletId: dto.outletId, type: 'supplier_payment_recorded',
        title: `Supplier Payment Recorded - #${payment.paymentNo}`,
        body: `Payment of ${dto.amount} recorded for supplier #${dto.supplierId}`,
        data: JSON.stringify({ paymentId: payment.id, supplierId: dto.supplierId }),
      })
      .then((notification) => this.gateway.notifyNotificationCreated(notification))
      .catch((error: Error) =>
        this.logger.error(`Failed to create supplier_payment_recorded notification for payment ${payment.id}: ${error.message}`),
      );

    return payment;
  }

  async cancel(id: number): Promise<SupplierPayment> {
    const payment = await this.findOne(id);
    if (payment.status === 'cancelled') throw new NotFoundException(`Payment ${id} already cancelled`);
    payment.status = 'cancelled';
    await this.suppliersService.adjustOutstandingBalance(payment.supplierId, payment.amount);
    return this.paymentRepo.save(payment);
  }
}
