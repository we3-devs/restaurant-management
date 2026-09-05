import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { WarehouseIngredientStocksService } from '../inventory-stock/warehouse-ingredient-stocks.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { SuppliersService } from '../suppliers/suppliers.service';
import { GoodsReceiving } from './entities/goods-receiving.entity';
import { GoodsReceivingItem } from './entities/goods-receiving-item.entity';
import { CreateGoodsReceivingDto, AddGoodsReceivingItemDto } from './dto/create-goods-receiving.dto';
import { ListGoodsReceivingQueryDto } from './dto/list-goods-receiving-query.dto';

function round2(v: number): number { return Math.round(v * 100) / 100; }

@Injectable()
export class GoodsReceivingService {
  constructor(
    @InjectRepository(GoodsReceiving) private readonly grnRepo: Repository<GoodsReceiving>,
    @InjectRepository(GoodsReceivingItem) private readonly itemsRepo: Repository<GoodsReceivingItem>,
    private readonly poService: PurchaseOrdersService,
    private readonly stockService: WarehouseIngredientStocksService,
    private readonly ingredientsService: IngredientsService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
    private readonly suppliersService: SuppliersService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: ListGoodsReceivingQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<GoodsReceiving>> {
    const { page, limit, search, status, purchaseOrderId, outletId, warehouseId } = query;
    const where: FindOptionsWhere<GoodsReceiving> = {};
    if (status) where.status = status;
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
    if (outletId) where.outletId = outletId;
    else if (accessibleOutletIds !== 'ALL') where.outletId = In(accessibleOutletIds);
    if (warehouseId) where.warehouseId = warehouseId;
    if (search) { where.grnNo = ILike(`%${search}%`); }
    const [data, total] = await this.grnRepo.findAndCount({
      where, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit,
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async findOne(id: number): Promise<GoodsReceiving> {
    const grn = await this.grnRepo.findOne({ where: { id } });
    if (!grn) throw new NotFoundException(`Goods receiving ${id} not found`);
    return grn;
  }

  async create(dto: CreateGoodsReceivingDto, createdBy: number): Promise<GoodsReceiving> {
    const po = dto.purchaseOrderId ? await this.poService.findOne(dto.purchaseOrderId) : null;
    if (po && po.status !== 'approved' && po.status !== 'partially_received') {
      throw new BadRequestException(`PO ${po.poNo} is ${po.status}, cannot receive`);
    }

    return this.dataSource.transaction(async (manager) => {
      const grnRepo = manager.getRepository(GoodsReceiving);
      const grn = await grnRepo.save(grnRepo.create({
        purchaseOrderId: dto.purchaseOrderId ?? null, supplierId: dto.supplierId,
        outletId: dto.outletId, warehouseId: dto.warehouseId,
        receivedDate: dto.receivedDate, notes: dto.notes ?? null,
        grnNo: generateDocumentNumber('GRN', dto.outletId),
        createdBy, status: 'received',
      }));

      let receivedTotal = 0;
      if (dto.items?.length) {
        for (const item of dto.items) {
          const poItem = po && item.purchaseOrderItemId
            ? await this.poService['findItem'](po.id, item.purchaseOrderItemId)
            : null;
          if (po && !poItem) {
            throw new BadRequestException('Purchase order item is required for PO-linked receiving');
          }
          const newReceived = poItem ? poItem.receivedQuantity + item.quantityReceived : 0;
          const remaining = poItem ? poItem.quantity - newReceived : 0;
          if (poItem && newReceived > poItem.quantity) {
            throw new BadRequestException(`Over-receiving PO item ${item.purchaseOrderItemId}: ordered ${poItem.quantity}, already received ${poItem.receivedQuantity}, attempting to receive ${item.quantityReceived}`);
          }

          const ingredient = await this.ingredientsService.findOne(item.ingredientId);
          this.ingredientsService.assertTrackable(ingredient);

          const unitCost = item.unitCost ?? (poItem ? Number(poItem.unitCost) : Number((ingredient as any).buyingPrice ?? 0));
          const itemTotalCost = round2(unitCost * item.quantityReceived);
          await manager.getRepository(GoodsReceivingItem).save(manager.getRepository(GoodsReceivingItem).create({
            goodsReceivingId: grn.id, purchaseOrderItemId: item.purchaseOrderItemId ?? null,
            ingredientId: item.ingredientId, quantityReceived: item.quantityReceived,
            unitCost,
            totalCost: itemTotalCost,
            batchNo: item.batchNo ?? null, expiryDate: item.expiryDate ?? null,
          }));
          receivedTotal += itemTotalCost;

          if (poItem && item.purchaseOrderItemId) {
            await manager.getRepository('purchase_order_items').update(item.purchaseOrderItemId, {
              receivedQuantity: newReceived,
              remainingQuantity: Math.max(0, remaining),
            });
          }

          await this.stockService.applyMovement({
            warehouseId: dto.warehouseId,
            ingredientId: item.ingredientId,
            quantityDelta: item.quantityReceived,
            unitCost,
            transactionType: 'purchase_receive',
            referenceType: 'goods_receiving',
            referenceId: grn.id,
            createdBy,
            manager,
          });
        }
      }

      if (receivedTotal > 0) {
        await this.suppliersService.adjustOutstandingBalance(dto.supplierId, receivedTotal, manager);
      }

      if (po) {
        const allItems = await manager.getRepository('purchase_order_items').find({ where: { purchaseOrderId: po.id } });
        const allReceived = allItems.every((i: any) => i.received_quantity >= i.quantity);
        const anyReceived = allItems.some((i: any) => i.received_quantity > 0);
        const poStatus = allReceived ? 'received' : anyReceived ? 'partially_received' : 'approved';
        await manager.getRepository('purchase_orders').update(po.id, { status: poStatus } as any);
      }

      const notification = await this.notificationsService.create({
        outletId: dto.outletId, type: 'goods_received',
        title: `Goods Received - GRN #${grn.grnNo}`,
        body: po ? `Goods received against PO #${po.poNo}` : 'Goods received without a purchase order',
        data: JSON.stringify({ grnId: grn.id, ...(po ? { poId: po.id, poNo: po.poNo } : {}) }),
      });
      this.gateway.notifyNotificationCreated(notification);

      return grn;
    });
  }

  async cancel(id: number): Promise<GoodsReceiving> {
    const grn = await this.findOne(id);
    if (grn.status !== 'draft') throw new BadRequestException(`GRN ${id} is ${grn.status}, cannot cancel`);
    grn.status = 'cancelled';
    return this.grnRepo.save(grn);
  }

  async listItems(grnId: number): Promise<GoodsReceivingItem[]> {
    await this.findOne(grnId);
    return this.itemsRepo.find({ where: { goodsReceivingId: grnId }, order: { id: 'ASC' } });
  }
}
