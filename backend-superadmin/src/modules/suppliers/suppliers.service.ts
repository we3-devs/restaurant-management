import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { NotificationsService } from '../notifications/notifications.service';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { SupplierCategory } from './entities/supplier-category.entity';
import { Supplier } from './entities/supplier.entity';
import {
  CreateSupplierCategoryDto,
  UpdateSupplierCategoryDto,
} from './dto/create-supplier-category.dto';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
} from './dto/create-supplier.dto';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(SupplierCategory)
    private readonly categoriesRepository: Repository<SupplierCategory>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
  ) {}

  /**
   * Applies a signed delta to a supplier's outstanding balance (positive = supplier owed more,
   * e.g. goods received on credit; negative = balance reduced, e.g. payment or refund return).
   * Used by goods-receiving/supplier-payments/purchase-returns so the calculation lives in one place.
   */
  async adjustOutstandingBalance(
    id: number,
    delta: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(Supplier)
      : this.suppliersRepository;
    await repo
      .createQueryBuilder()
      .update(Supplier)
      .set({
        outstandingBalance: () => `GREATEST(0, outstanding_balance + ${delta})`,
      })
      .where('id = :id', { id })
      .execute();

    const supplier = await repo.findOne({ where: { id } });
    if (
      supplier &&
      supplier.creditLimit > 0 &&
      supplier.outstandingBalance > supplier.creditLimit
    ) {
      const notification = await this.notificationsService.create({
        outletId: supplier.outletId,
        type: 'low_supplier_credit',
        title: `Supplier Credit Limit Exceeded`,
        body: `${supplier.companyName} owes ${supplier.outstandingBalance}, above the credit limit of ${supplier.creditLimit}`,
        data: JSON.stringify({
          supplierId: supplier.id,
          outstandingBalance: supplier.outstandingBalance,
          creditLimit: supplier.creditLimit,
        }),
      });
      this.gateway.notifyNotificationCreated(notification);
    }
  }

  /** Active suppliers currently owing more than their credit limit — used by the outstanding-balance sweep job. */
  async findOverCreditLimit(): Promise<Supplier[]> {
    return this.suppliersRepository
      .createQueryBuilder('supplier')
      .where('supplier.status = :status', { status: 'active' })
      .andWhere('supplier.credit_limit > 0')
      .andWhere('supplier.outstanding_balance > supplier.credit_limit')
      .getMany();
  }

  // ---- Supplier Categories ----

  async findAllCategories(): Promise<SupplierCategory[]> {
    return this.categoriesRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findCategory(id: number): Promise<SupplierCategory> {
    const cat = await this.categoriesRepository.findOne({ where: { id } });
    if (!cat) throw new NotFoundException(`Supplier category ${id} not found`);
    return cat;
  }

  async createCategory(
    dto: CreateSupplierCategoryDto,
  ): Promise<SupplierCategory> {
    return this.categoriesRepository.save(
      this.categoriesRepository.create(dto),
    );
  }

  async updateCategory(
    id: number,
    dto: UpdateSupplierCategoryDto,
  ): Promise<SupplierCategory> {
    const cat = await this.findCategory(id);
    Object.assign(cat, dto);
    return this.categoriesRepository.save(cat);
  }

  async removeCategory(id: number): Promise<void> {
    await this.findCategory(id);
    await this.categoriesRepository.delete(id);
  }

  // ---- Suppliers ----

  async findAll(
    query: ListSuppliersQueryDto,
  ): Promise<PaginatedResponse<Supplier>> {
    const { page, limit, search, status, categoryId, outletId } = query;
    const where: FindOptionsWhere<Supplier> = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (outletId) where.outletId = outletId;
    if (search) {
      const [data, total] = await this.suppliersRepository.findAndCount({
        where: [
          { ...where, companyName: ILike(`%${search}%`) },
          { ...where, contactPerson: ILike(`%${search}%`) },
          { ...where, email: ILike(`%${search}%`) },
          { ...where, phone: ILike(`%${search}%`) },
        ],
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return {
        data,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      };
    }
    const [data, total] = await this.suppliersRepository.findAndCount({
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

  async findOne(id: number): Promise<Supplier> {
    const supplier = await this.suppliersRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }

  async create(dto: CreateSupplierDto, createdBy: number): Promise<Supplier> {
    if (dto.categoryId) await this.findCategory(dto.categoryId);
    return this.suppliersRepository.save(
      this.suppliersRepository.create({
        ...dto,
        supplierNo: generateDocumentNumber('SUP', dto.outletId),
        createdBy,
      }),
    );
  }

  async update(id: number, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);
    if (dto.categoryId) await this.findCategory(dto.categoryId);
    Object.assign(supplier, dto);
    return this.suppliersRepository.save(supplier);
  }

  async remove(id: number): Promise<void> {
    const supplier = await this.findOne(id);
    await this.suppliersRepository.remove(supplier);
  }

  // Supplier History (aggregated for supplier detail page)
  async getHistory(id: number): Promise<Record<string, unknown>> {
    const supplier = await this.findOne(id);
    const manager = this.suppliersRepository.manager;

    const [poCount, grnCount, returnCount, paymentCount, purchaseSummary, recentOrderRows] =
      await Promise.all([
        manager
          .createQueryBuilder()
          .select('COUNT(*)', 'count')
          .from('purchase_orders', 'po')
          .where('po.supplier_id = :id', { id })
          .getRawOne<{ count: string }>(),
        manager
          .createQueryBuilder()
          .select('COUNT(*)', 'count')
          .from('goods_receivings', 'grn')
          .where('grn.supplier_id = :id', { id })
          .getRawOne<{ count: string }>(),
        manager
          .createQueryBuilder()
          .select('COUNT(*)', 'count')
          .from('purchase_returns', 'pr')
          .where('pr.supplier_id = :id', { id })
          .getRawOne<{ count: string }>(),
        manager
          .createQueryBuilder()
          .select('COUNT(*)', 'count')
          .from('supplier_payments', 'sp')
          .where('sp.supplier_id = :id', { id })
          .getRawOne<{ count: string }>(),
        manager
          .createQueryBuilder()
          .select("COALESCE(SUM(CASE WHEN po.status <> 'cancelled' THEN po.grand_total ELSE 0 END), 0)", 'totalPurchased')
          .addSelect('MAX(po.created_at)', 'lastPurchaseDate')
          .from('purchase_orders', 'po')
          .where('po.supplier_id = :id', { id })
          .getRawOne<{ totalPurchased: string; lastPurchaseDate: string | null }>(),
        manager
          .createQueryBuilder()
          .select('po.po_no', 'poNo')
          .addSelect('po.grand_total', 'grandTotal')
          .addSelect('po.status', 'status')
          // Explicitly expose the database column in the API response.
          .addSelect('po.created_at', 'createdAt')
          .from('purchase_orders', 'po')
          .where('po.supplier_id = :id', { id })
          .orderBy('po.created_at', 'DESC')
          .limit(10)
          .getRawMany(),
      ]);

    return {
      supplier: {
        ...supplier,
        totalPurchased: Number(purchaseSummary?.totalPurchased ?? supplier.totalPurchased ?? 0),
        lastPurchaseDate: purchaseSummary?.lastPurchaseDate
          ? new Date(purchaseSummary.lastPurchaseDate).toISOString().slice(0, 10)
          : supplier.lastPurchaseDate,
      },
      purchaseOrderCount: Number(poCount?.count ?? 0),
      goodsReceivedCount: Number(grnCount?.count ?? 0),
      purchaseReturnCount: Number(returnCount?.count ?? 0),
      paymentCount: Number(paymentCount?.count ?? 0),
      recentPurchaseOrders: recentOrderRows.map((order: { poNo?: string; grandTotal?: string | number; status?: string; createdAt?: string | Date; createdat?: string | Date; created_at?: string | Date }) => {
        const rawDate = order.createdAt ?? order.createdat ?? order.created_at;
        const timestampFromNumber = order.poNo?.match(/^[^-]+-[^-]+-(\d+)-/)?.[1];
        const createdAt = rawDate ? new Date(rawDate).toISOString() : (timestampFromNumber ? new Date(Number(timestampFromNumber)).toISOString() : null);
        return {
          status: order.status ?? null,
          poNo: order.poNo ?? null,
          grandTotal: order.grandTotal ?? 0,
          createdAt,
        };
      }),
    };
  }
}
