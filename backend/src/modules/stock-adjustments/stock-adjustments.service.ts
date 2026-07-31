import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { IngredientsService } from '../ingredients/ingredients.service';
import { WarehouseIngredientStocksService } from '../inventory-stock/warehouse-ingredient-stocks.service';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateStockAdjustmentItemDto } from './dto/create-stock-adjustment-item.dto';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { ListStockAdjustmentsQueryDto } from './dto/list-stock-adjustments-query.dto';
import { UpdateStockAdjustmentItemDto } from './dto/update-stock-adjustment-item.dto';
import { UpdateStockAdjustmentDto } from './dto/update-stock-adjustment.dto';
import { IngredientStockAdjustmentItem } from './entities/ingredient-stock-adjustment-item.entity';
import { IngredientStockAdjustment } from './entities/ingredient-stock-adjustment.entity';

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

@Injectable()
export class StockAdjustmentsService {
  constructor(
    @InjectRepository(IngredientStockAdjustment)
    private readonly adjustmentsRepository: Repository<IngredientStockAdjustment>,
    @InjectRepository(IngredientStockAdjustmentItem)
    private readonly itemsRepository: Repository<IngredientStockAdjustmentItem>,
    private readonly warehousesService: WarehousesService,
    private readonly ingredientsService: IngredientsService,
    private readonly warehouseIngredientStocksService: WarehouseIngredientStocksService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
  ) {}

  async findAll(
    query: ListStockAdjustmentsQueryDto,
  ): Promise<PaginatedResponse<IngredientStockAdjustment>> {
    const { page, limit, warehouseId, status, search } = query;
    const where: FindOptionsWhere<IngredientStockAdjustment> = {};
    if (warehouseId !== undefined) {
      where.warehouseId = warehouseId;
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (search) {
      where.adjustmentNo = ILike(`%${search}%`);
    }

    const [data, total] = await this.adjustmentsRepository.findAndCount({
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

  async findOne(id: number): Promise<IngredientStockAdjustment> {
    const adjustment = await this.adjustmentsRepository.findOne({
      where: { id },
    });
    if (!adjustment) {
      throw new NotFoundException(`Stock adjustment ${id} not found`);
    }
    return adjustment;
  }

  async create(
    dto: CreateStockAdjustmentDto,
    createdBy: number,
  ): Promise<IngredientStockAdjustment> {
    await this.warehousesService.findOne(dto.warehouseId);

    return this.adjustmentsRepository.save(
      this.adjustmentsRepository.create({
        warehouseId: dto.warehouseId,
        adjustmentDate: dto.adjustmentDate,
        reason: dto.reason ?? null,
        adjustmentNo: generateDocumentNumber('ADJ', dto.warehouseId),
        createdBy,
      }),
    );
  }

  async update(
    id: number,
    dto: UpdateStockAdjustmentDto,
  ): Promise<IngredientStockAdjustment> {
    const adjustment = await this.assertDraft(id);

    Object.assign(adjustment, {
      ...(dto.adjustmentDate !== undefined && {
        adjustmentDate: dto.adjustmentDate,
      }),
      ...(dto.reason !== undefined && { reason: dto.reason }),
    });
    return this.adjustmentsRepository.save(adjustment);
  }

  async remove(id: number): Promise<void> {
    await this.assertDraft(id);
    await this.adjustmentsRepository.delete(id);
  }

  // ------------------------------------------------------------------ items

  async listItems(
    adjustmentId: number,
  ): Promise<IngredientStockAdjustmentItem[]> {
    await this.findOne(adjustmentId);
    return this.itemsRepository.find({
      where: { ingredientStockAdjustmentId: adjustmentId },
    });
  }

  async addItem(
    adjustmentId: number,
    dto: CreateStockAdjustmentItemDto,
  ): Promise<IngredientStockAdjustmentItem> {
    const adjustment = await this.assertDraft(adjustmentId);
    await this.ingredientsService.findOne(dto.ingredientId);

    const currentStock = await this.warehouseIngredientStocksService.getStock(
      adjustment.warehouseId,
      dto.ingredientId,
    );
    const systemQuantity = currentStock.quantity;
    const differenceQuantity = round4(dto.actualQuantity - systemQuantity);

    return this.itemsRepository.save(
      this.itemsRepository.create({
        ingredientStockAdjustmentId: adjustmentId,
        ingredientId: dto.ingredientId,
        ingredientBatchId: null,
        systemQuantity,
        actualQuantity: dto.actualQuantity,
        differenceQuantity,
        unitCost: 0,
        differenceValue: 0,
        remarks: dto.remarks ?? null,
      }),
    );
  }

  async updateItem(
    adjustmentId: number,
    itemId: number,
    dto: UpdateStockAdjustmentItemDto,
  ): Promise<IngredientStockAdjustmentItem> {
    const adjustment = await this.assertDraft(adjustmentId);
    const item = await this.findItem(adjustmentId, itemId);

    if (dto.actualQuantity !== undefined) {
      const currentStock = await this.warehouseIngredientStocksService.getStock(
        adjustment.warehouseId,
        item.ingredientId,
      );
      item.systemQuantity = currentStock.quantity;
      item.actualQuantity = dto.actualQuantity;
      item.differenceQuantity = round4(
        dto.actualQuantity - currentStock.quantity,
      );
    }
    return this.itemsRepository.save(item);
  }

  async removeItem(adjustmentId: number, itemId: number): Promise<void> {
    await this.assertDraft(adjustmentId);
    const item = await this.findItem(adjustmentId, itemId);
    await this.itemsRepository.remove(item);
  }

  // --------------------------------------------------------------- terminal

  async approve(
    id: number,
    approvedBy: number,
  ): Promise<IngredientStockAdjustment> {
    const adjustment = await this.assertDraft(id);
    const items = await this.itemsRepository.find({
      where: { ingredientStockAdjustmentId: id },
    });
    if (items.length === 0) {
      throw new BadRequestException(
        'Cannot approve a stock adjustment with no items',
      );
    }

    for (const item of items) {
      if (item.differenceQuantity === 0) {
        continue;
      }
      // A correction doesn't change the cost basis — an adjustment_in is
      // costed at the warehouse's current average, same as an adjustment_out.
      const currentStock = await this.warehouseIngredientStocksService.getStock(
        adjustment.warehouseId,
        item.ingredientId,
      );
      const stock = await this.warehouseIngredientStocksService.applyMovement({
        warehouseId: adjustment.warehouseId,
        ingredientId: item.ingredientId,
        quantityDelta: item.differenceQuantity,
        unitCost: currentStock.averageCost,
        transactionType:
          item.differenceQuantity > 0 ? 'adjustment_in' : 'adjustment_out',
        referenceType: 'stock_adjustment',
        referenceId: id,
        createdBy: approvedBy,
      });
      item.unitCost = stock.averageCost;
      item.differenceValue = round4(
        item.differenceQuantity * stock.averageCost,
      );
      await this.itemsRepository.save(item);
    }

    adjustment.status = 'approved';
    adjustment.approvedBy = approvedBy;
    adjustment.approvedAt = new Date();
    const saved = await this.adjustmentsRepository.save(adjustment);

    const warehouse = await this.warehousesService.findOne(
      adjustment.warehouseId,
    );
    const notification = await this.notificationsService.create({
      outletId: warehouse.outletId,
      type: 'stock_adjustment',
      title: `Stock adjustment ${adjustment.adjustmentNo} approved`,
      body: `${items.length} item(s) adjusted at ${warehouse.name}`,
      actorUserId: approvedBy,
      data: JSON.stringify({ adjustmentId: id }),
    });
    this.gateway.notifyNotificationCreated(notification);

    return saved;
  }

  async cancel(id: number): Promise<IngredientStockAdjustment> {
    const adjustment = await this.assertDraft(id);
    adjustment.status = 'cancelled';
    return this.adjustmentsRepository.save(adjustment);
  }

  // ----------------------------------------------------------------- private

  private async assertDraft(id: number): Promise<IngredientStockAdjustment> {
    const adjustment = await this.findOne(id);
    if (adjustment.status !== 'draft') {
      throw new BadRequestException(
        `Stock adjustment ${id} is ${adjustment.status}, not draft`,
      );
    }
    return adjustment;
  }

  private async findItem(
    adjustmentId: number,
    itemId: number,
  ): Promise<IngredientStockAdjustmentItem> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId, ingredientStockAdjustmentId: adjustmentId },
    });
    if (!item) {
      throw new NotFoundException(
        `Stock adjustment item ${itemId} not found on adjustment ${adjustmentId}`,
      );
    }
    return item;
  }
}
