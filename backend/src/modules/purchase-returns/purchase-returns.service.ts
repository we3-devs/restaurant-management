import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { WarehouseIngredientStocksService } from '../inventory-stock/warehouse-ingredient-stocks.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { NotificationsService } from '../notifications/notifications.service';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { SuppliersService } from '../suppliers/suppliers.service';
import { PurchaseReturn } from './entities/purchase-return.entity';
import { PurchaseReturnItem } from './entities/purchase-return-item.entity';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { ListPurchaseReturnsQueryDto } from './dto/list-purchase-returns-query.dto';

@Injectable()
export class PurchaseReturnsService {
  constructor(
    @InjectRepository(PurchaseReturn) private readonly prRepo: Repository<PurchaseReturn>,
    @InjectRepository(PurchaseReturnItem) private readonly itemsRepo: Repository<PurchaseReturnItem>,
    private readonly stockService: WarehouseIngredientStocksService,
    private readonly ingredientsService: IngredientsService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
    private readonly suppliersService: SuppliersService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: ListPurchaseReturnsQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<PurchaseReturn>> {
    const { page, limit, search, status, supplierId, outletId } = query;
    const where: FindOptionsWhere<PurchaseReturn> = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (outletId) where.outletId = outletId;
    else if (accessibleOutletIds !== 'ALL') where.outletId = In(accessibleOutletIds);
    if (search) { where.returnNo = ILike(`%${search}%`); }
    const [data, total] = await this.prRepo.findAndCount({ where, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async findOne(id: number): Promise<PurchaseReturn> {
    const pr = await this.prRepo.findOne({ where: { id } });
    if (!pr) throw new NotFoundException(`Purchase return ${id} not found`);
    return pr;
  }

  async create(dto: CreatePurchaseReturnDto, createdBy: number): Promise<PurchaseReturn> {
    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PurchaseReturn);
      const pr = await prRepo.save(prRepo.create({
        purchaseOrderId: dto.purchaseOrderId, supplierId: dto.supplierId,
        outletId: dto.outletId, warehouseId: dto.warehouseId,
        returnDate: dto.returnDate, reason: dto.reason ?? null,
        refundType: dto.refundType ?? 'refund',
        returnNo: generateDocumentNumber('PR', dto.outletId), createdBy, status: 'draft',
      }));

      if (dto.items?.length) {
        for (const item of dto.items) {
          const ingredient = await this.ingredientsService.findOne(item.ingredientId);
          this.ingredientsService.assertTrackable(ingredient);

          const totalCost = (item.unitCost ?? 0) * item.quantity;
          await manager.getRepository(PurchaseReturnItem).save(manager.getRepository(PurchaseReturnItem).create({
            purchaseReturnId: pr.id, purchaseOrderItemId: item.purchaseOrderItemId,
            ingredientId: item.ingredientId, quantity: item.quantity,
            unitCost: item.unitCost ?? 0, totalCost,
          }));
        }
      }
      return pr;
    });
  }

  async process(id: number, userId: number): Promise<PurchaseReturn> {
    const pr = await this.findOne(id);
    if (pr.status !== 'draft') throw new BadRequestException(`Purchase return ${id} is ${pr.status}, not draft`);

    return this.dataSource.transaction(async (manager) => {
      const items = await manager.getRepository(PurchaseReturnItem).find({ where: { purchaseReturnId: id } });
      if (!items.length) throw new BadRequestException('Cannot process a return with no items');

      for (const item of items) {
        await this.stockService.applyMovement({
          warehouseId: pr.warehouseId, ingredientId: item.ingredientId,
          quantityDelta: -item.quantity, unitCost: item.unitCost,
          transactionType: 'purchase_return',
          referenceType: 'purchase_return', referenceId: id,
          createdBy: userId, manager,
        });
      }

      pr.status = 'processed';
      const saved = await manager.getRepository(PurchaseReturn).save(pr);

      if (pr.refundType === 'refund' || pr.refundType === 'both') {
        const totalRefund = items.reduce((sum, item) => sum + Number(item.totalCost), 0);
        if (totalRefund > 0) {
          await this.suppliersService.adjustOutstandingBalance(pr.supplierId, -totalRefund, manager);
        }
      }

      const notification = await this.notificationsService.create({
        outletId: pr.outletId, type: 'purchase_return',
        title: `Purchase Return #${pr.returnNo} Processed`,
        body: `Return processed against PO, inventory updated`,
        data: JSON.stringify({ returnId: id, returnNo: pr.returnNo }),
      });
      this.gateway.notifyNotificationCreated(notification);

      return saved;
    });
  }

  async cancel(id: number): Promise<PurchaseReturn> {
    const pr = await this.findOne(id);
    if (pr.status !== 'draft') throw new BadRequestException(`Purchase return ${id} is ${pr.status}, cannot cancel`);
    pr.status = 'cancelled';
    return this.prRepo.save(pr);
  }

  async listItems(prId: number): Promise<PurchaseReturnItem[]> {
    await this.findOne(prId);
    return this.itemsRepo.find({ where: { purchaseReturnId: prId }, order: { id: 'ASC' } });
  }
}
