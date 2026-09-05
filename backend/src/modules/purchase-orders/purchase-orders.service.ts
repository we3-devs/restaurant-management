import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { NotificationsService } from '../notifications/notifications.service';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  VALID_PO_TRANSITIONS,
} from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  AddPurchaseOrderItemDto,
  UpdatePurchaseOrderItemDto,
} from './dto/create-purchase-order.dto';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders-query.dto';

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function lineTotal(quantity: number, unitCost: number, discount = 0, taxPercent = 0): number {
  const base = quantity * unitCost;
  const afterDiscount = Math.max(0, base - discount);
  return round2(afterDiscount + afterDiscount * (taxPercent / 100));
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly itemsRepo: Repository<PurchaseOrderItem>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
  ) {}

  async findAll(
    query: ListPurchaseOrdersQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<PurchaseOrder>> {
    const { page, limit, search, status, supplierId, outletId, warehouseId } =
      query;
    const where: FindOptionsWhere<PurchaseOrder> = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (outletId) where.outletId = outletId;
    else if (accessibleOutletIds !== 'ALL') where.outletId = In(accessibleOutletIds);
    if (warehouseId) where.warehouseId = warehouseId;
    if (search) {
      where.poNo = ILike(`%${search}%`);
    }
    const [data, total] = await this.poRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: number): Promise<PurchaseOrder> {
    const po = await this.poRepo.findOne({ where: { id } });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    return po;
  }

  async create(
    dto: CreatePurchaseOrderDto,
    createdBy: number,
  ): Promise<PurchaseOrder> {
    let subtotal = 0;
    const po = await this.poRepo.save(
      this.poRepo.create({
        supplierId: dto.supplierId,
        outletId: dto.outletId,
        warehouseId: dto.warehouseId,
        expectedDeliveryDate: dto.expectedDeliveryDate ?? null,
        currency: dto.currency ?? 'NPR',
        notes: dto.notes ?? null,
        discountAmount: dto.discountAmount ?? 0,
        taxAmount: dto.taxAmount ?? 0,
        poNo: generateDocumentNumber('PO', dto.outletId),
        createdBy,
        status: 'draft',
      }),
    );

    if (dto.items?.length) {
      for (const item of dto.items) {
        const total = lineTotal(item.quantity, item.unitCost ?? 0, item.discount ?? 0, item.tax ?? 0);
        await this.itemsRepo.save(
          this.itemsRepo.create({
            purchaseOrderId: po.id,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit ?? null,
            unitCost: item.unitCost ?? 0,
            discount: item.discount ?? 0,
            tax: item.tax ?? 0,
            total,
            remainingQuantity: item.quantity,
          }),
        );
        subtotal += total;
      }
      po.subtotal = subtotal;
      po.grandTotal = round2(
        subtotal + (dto.taxAmount ?? 0) - (dto.discountAmount ?? 0),
      );
      await this.poRepo.save(po);
    }
    return this.findOne(po.id);
  }

  async update(
    id: number,
    dto: UpdatePurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const po = await this.assertStatus(id, 'draft');
    Object.assign(po, {
      ...(dto.expectedDeliveryDate !== undefined && {
        expectedDeliveryDate: dto.expectedDeliveryDate,
      }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.discountAmount !== undefined && {
        discountAmount: dto.discountAmount,
      }),
      ...(dto.taxAmount !== undefined && { taxAmount: dto.taxAmount }),
    });
    po.grandTotal = round2(po.subtotal + po.taxAmount - po.discountAmount);
    return this.poRepo.save(po);
  }

  async remove(id: number): Promise<void> {
    await this.assertStatus(id, 'draft');
    await this.poRepo.delete(id);
  }

  async submitForApproval(id: number): Promise<PurchaseOrder> {
    return this.transition(id, 'pending_approval');
  }

  async approve(id: number, approvedBy: number): Promise<PurchaseOrder> {
    const po = await this.transition(id, 'approved');
    po.approvedBy = approvedBy;
    po.approvedAt = new Date();
    await this.poRepo.save(po);
    const notification = await this.notificationsService.create({
      outletId: po.outletId,
      type: 'purchase_order_approved',
      title: `Purchase Order ${po.poNo} Approved`,
      body: `PO #${po.poNo} has been approved`,
      data: JSON.stringify({ poId: po.id, poNo: po.poNo }),
    });
    this.gateway.notifyNotificationCreated(notification);
    return po;
  }

  async reject(id: number): Promise<PurchaseOrder> {
    const po = await this.transition(id, 'cancelled');
    const notification = await this.notificationsService.create({
      outletId: po.outletId,
      type: 'purchase_order_rejected',
      title: `Purchase Order ${po.poNo} Rejected`,
      body: `PO #${po.poNo} has been rejected`,
      data: JSON.stringify({ poId: po.id, poNo: po.poNo }),
    });
    this.gateway.notifyNotificationCreated(notification);
    return po;
  }

  async cancel(id: number): Promise<PurchaseOrder> {
    return this.transition(id, 'cancelled');
  }

  async listItems(poId: number): Promise<PurchaseOrderItem[]> {
    await this.findOne(poId);
    return this.itemsRepo.find({
      where: { purchaseOrderId: poId },
      order: { id: 'ASC' },
    });
  }

  async addItem(
    poId: number,
    dto: AddPurchaseOrderItemDto,
  ): Promise<PurchaseOrderItem> {
    const po = await this.assertStatus(poId, 'draft');
    const total = lineTotal(dto.quantity, dto.unitCost ?? 0, dto.discount ?? 0, dto.tax ?? 0);
    const item = await this.itemsRepo.save(
      this.itemsRepo.create({
        purchaseOrderId: poId,
        ingredientId: dto.ingredientId,
        quantity: dto.quantity,
        unit: dto.unit ?? null,
        unitCost: dto.unitCost ?? 0,
        discount: dto.discount ?? 0,
        tax: dto.tax ?? 0,
        total,
        remainingQuantity: dto.quantity,
      }),
    );
    await this.recalculateTotals(po);
    return item;
  }

  async updateItem(
    poId: number,
    itemId: number,
    dto: UpdatePurchaseOrderItemDto,
  ): Promise<PurchaseOrderItem> {
    await this.assertStatus(poId, 'draft');
    const item = await this.findItem(poId, itemId);
    const qty = dto.quantity ?? item.quantity;
    const cost = dto.unitCost ?? item.unitCost;
    Object.assign(item, {
      ...(dto.quantity !== undefined && { quantity: dto.quantity }),
      ...(dto.unit !== undefined && { unit: dto.unit }),
      ...(dto.unitCost !== undefined && { unitCost: dto.unitCost }),
      ...(dto.discount !== undefined && { discount: dto.discount }),
      ...(dto.tax !== undefined && { tax: dto.tax }),
      remainingQuantity: qty - (item.receivedQuantity ?? 0),
      total: lineTotal(qty, cost, dto.discount ?? item.discount, dto.tax ?? item.tax),
    });
    const saved = await this.itemsRepo.save(item);
    const po = await this.findOne(poId);
    await this.recalculateTotals(po);
    return saved;
  }

  async removeItem(poId: number, itemId: number): Promise<void> {
    await this.assertStatus(poId, 'draft');
    const item = await this.findItem(poId, itemId);
    await this.itemsRepo.remove(item);
    const po = await this.findOne(poId);
    await this.recalculateTotals(po);
  }

  private async recalculateTotals(po: PurchaseOrder): Promise<void> {
    const items = await this.itemsRepo.find({
      where: { purchaseOrderId: po.id },
    });
    po.subtotal = items.reduce((s, i) => s + i.total, 0);
    po.grandTotal = round2(po.subtotal + po.taxAmount - po.discountAmount);
    await this.poRepo.save(po);
  }

  private async transition(
    id: number,
    target: PurchaseOrderStatus,
  ): Promise<PurchaseOrder> {
    const po = await this.findOne(id);
    const allowed = VALID_PO_TRANSITIONS[po.status] ?? [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Cannot transition PO ${id} from ${po.status} to ${target}`,
      );
    }
    po.status = target;
    return this.poRepo.save(po);
  }

  async assertStatus(
    id: number,
    expected: PurchaseOrderStatus,
  ): Promise<PurchaseOrder> {
    const po = await this.findOne(id);
    if (po.status !== expected)
      throw new BadRequestException(
        `PO ${id} is ${po.status}, not ${expected}`,
      );
    return po;
  }

  private async findItem(
    poId: number,
    itemId: number,
  ): Promise<PurchaseOrderItem> {
    const item = await this.itemsRepo.findOne({
      where: { id: itemId, purchaseOrderId: poId },
    });
    if (!item)
      throw new NotFoundException(`PO item ${itemId} not found on PO ${poId}`);
    return item;
  }

  /** POs still awaiting delivery whose expected date has already passed. */
  async findOverdue(): Promise<PurchaseOrder[]> {
    return this.poRepo
      .createQueryBuilder('po')
      .where('po.status IN (:...statuses)', {
        statuses: ['approved', 'partially_received'],
      })
      .andWhere('po.expected_delivery_date IS NOT NULL')
      .andWhere('po.expected_delivery_date < :today', {
        today: new Date().toISOString().slice(0, 10),
      })
      .getMany();
  }

  /** POs still awaiting delivery whose expected date falls within the next N hours. */
  async findUpcomingDeliveries(withinHours: number): Promise<PurchaseOrder[]> {
    const now = new Date();
    const until = new Date(now.getTime() + withinHours * 3_600_000);
    return this.poRepo
      .createQueryBuilder('po')
      .where('po.status IN (:...statuses)', {
        statuses: ['approved', 'partially_received'],
      })
      .andWhere('po.expected_delivery_date IS NOT NULL')
      .andWhere('po.expected_delivery_date BETWEEN :today AND :until', {
        today: now.toISOString().slice(0, 10),
        until: until.toISOString().slice(0, 10),
      })
      .getMany();
  }

  /** Aggregate count/spend for POs created within the given day, for the daily summary job. */
  async getDailySummary(
    date: string,
  ): Promise<{ count: number; totalValue: number }> {
    const row = await this.poRepo
      .createQueryBuilder('po')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(po.grand_total), 0)', 'totalValue')
      .where('po.created_at >= :start', { start: `${date}T00:00:00` })
      .andWhere('po.created_at < :end', { end: `${date}T23:59:59` })
      .getRawOne<{ count: string; totalValue: string }>();
    return {
      count: Number(row?.count ?? 0),
      totalValue: Number(row?.totalValue ?? 0),
    };
  }
}
