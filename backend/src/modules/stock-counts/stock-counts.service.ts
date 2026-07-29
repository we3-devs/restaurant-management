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
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateStockCountItemDto } from './dto/create-stock-count-item.dto';
import { CreateStockCountDto } from './dto/create-stock-count.dto';
import { ListStockCountsQueryDto } from './dto/list-stock-counts-query.dto';
import { UpdateStockCountItemDto } from './dto/update-stock-count-item.dto';
import { UpdateStockCountDto } from './dto/update-stock-count.dto';
import { IngredientStockCountItem } from './entities/ingredient-stock-count-item.entity';
import { IngredientStockCount } from './entities/ingredient-stock-count.entity';

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

@Injectable()
export class StockCountsService {
  constructor(
    @InjectRepository(IngredientStockCount)
    private readonly countsRepository: Repository<IngredientStockCount>,
    @InjectRepository(IngredientStockCountItem)
    private readonly itemsRepository: Repository<IngredientStockCountItem>,
    private readonly warehousesService: WarehousesService,
    private readonly ingredientsService: IngredientsService,
    private readonly warehouseIngredientStocksService: WarehouseIngredientStocksService,
  ) {}

  async findAll(
    query: ListStockCountsQueryDto,
  ): Promise<PaginatedResponse<IngredientStockCount>> {
    const { page, limit, warehouseId, status, search } = query;
    const where: FindOptionsWhere<IngredientStockCount> = {};
    if (warehouseId !== undefined) {
      where.warehouseId = warehouseId;
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (search) {
      where.countNo = ILike(`%${search}%`);
    }

    const [data, total] = await this.countsRepository.findAndCount({
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

  async findOne(id: number): Promise<IngredientStockCount> {
    const count = await this.countsRepository.findOne({ where: { id } });
    if (!count) {
      throw new NotFoundException(`Stock count ${id} not found`);
    }
    return count;
  }

  async create(
    dto: CreateStockCountDto,
    createdBy: number,
  ): Promise<IngredientStockCount> {
    await this.warehousesService.findOne(dto.warehouseId);

    return this.countsRepository.save(
      this.countsRepository.create({
        warehouseId: dto.warehouseId,
        countDate: dto.countDate,
        remarks: dto.remarks ?? null,
        countNo: generateDocumentNumber('CNT', dto.warehouseId),
        createdBy,
      }),
    );
  }

  async update(
    id: number,
    dto: UpdateStockCountDto,
  ): Promise<IngredientStockCount> {
    const count = await this.assertStatus(id, 'draft');

    Object.assign(count, {
      ...(dto.countDate !== undefined && { countDate: dto.countDate }),
      ...(dto.remarks !== undefined && { remarks: dto.remarks }),
    });
    return this.countsRepository.save(count);
  }

  async remove(id: number): Promise<void> {
    await this.assertStatus(id, 'draft');
    await this.countsRepository.delete(id);
  }

  // ------------------------------------------------------------------ items

  async listItems(countId: number): Promise<IngredientStockCountItem[]> {
    await this.findOne(countId);
    return this.itemsRepository.find({
      where: { ingredientStockCountId: countId },
    });
  }

  async addItem(
    countId: number,
    dto: CreateStockCountItemDto,
  ): Promise<IngredientStockCountItem> {
    await this.assertStatus(countId, 'draft');
    await this.ingredientsService.findOne(dto.ingredientId);

    return this.itemsRepository.save(
      this.itemsRepository.create({
        ingredientStockCountId: countId,
        ingredientId: dto.ingredientId,
        ingredientBatchId: null,
        systemQuantity: 0,
        countedQuantity: dto.countedQuantity,
        differenceQuantity: 0,
        unitCost: 0,
        differenceValue: 0,
        remarks: dto.remarks ?? null,
      }),
    );
  }

  async updateItem(
    countId: number,
    itemId: number,
    dto: UpdateStockCountItemDto,
  ): Promise<IngredientStockCountItem> {
    await this.assertStatus(countId, 'draft');
    const item = await this.findItem(countId, itemId);

    if (dto.countedQuantity !== undefined) {
      item.countedQuantity = dto.countedQuantity;
    }
    return this.itemsRepository.save(item);
  }

  async removeItem(countId: number, itemId: number): Promise<void> {
    await this.assertStatus(countId, 'draft');
    const item = await this.findItem(countId, itemId);
    await this.itemsRepository.remove(item);
  }

  // --------------------------------------------------------------- terminal

  async complete(
    id: number,
    completedBy: number,
  ): Promise<IngredientStockCount> {
    const count = await this.assertStatus(id, 'draft');
    const items = await this.itemsRepository.find({
      where: { ingredientStockCountId: id },
    });
    if (items.length === 0) {
      throw new BadRequestException(
        'Cannot complete a stock count with no items',
      );
    }

    for (const item of items) {
      const currentStock = await this.warehouseIngredientStocksService.getStock(
        count.warehouseId,
        item.ingredientId,
      );
      item.systemQuantity = currentStock.quantity;
      item.differenceQuantity = round4(
        item.countedQuantity - currentStock.quantity,
      );
      await this.itemsRepository.save(item);
    }

    count.status = 'completed';
    count.completedBy = completedBy;
    count.completedAt = new Date();
    return this.countsRepository.save(count);
  }

  async postAdjustments(
    id: number,
    approvedBy: number,
  ): Promise<IngredientStockCount> {
    const count = await this.assertStatus(id, 'completed');
    const items = await this.itemsRepository.find({
      where: { ingredientStockCountId: id },
    });

    for (const item of items) {
      if (item.differenceQuantity === 0) {
        continue;
      }
      const currentStock = await this.warehouseIngredientStocksService.getStock(
        count.warehouseId,
        item.ingredientId,
      );
      const stock = await this.warehouseIngredientStocksService.applyMovement({
        warehouseId: count.warehouseId,
        ingredientId: item.ingredientId,
        quantityDelta: item.differenceQuantity,
        unitCost: currentStock.averageCost,
        transactionType:
          item.differenceQuantity > 0 ? 'stock_count_gain' : 'stock_count_loss',
        referenceType: 'stock_count',
        referenceId: id,
        createdBy: approvedBy,
      });
      item.unitCost = stock.averageCost;
      item.differenceValue = round4(
        item.differenceQuantity * stock.averageCost,
      );
      await this.itemsRepository.save(item);
    }

    count.status = 'adjusted';
    return this.countsRepository.save(count);
  }

  async cancel(id: number): Promise<IngredientStockCount> {
    const count = await this.findOne(id);
    if (count.status !== 'draft' && count.status !== 'completed') {
      throw new BadRequestException(
        `Stock count ${id} is ${count.status} and can no longer be cancelled`,
      );
    }
    count.status = 'cancelled';
    return this.countsRepository.save(count);
  }

  // ----------------------------------------------------------------- private

  private async assertStatus(
    id: number,
    expected: IngredientStockCount['status'],
  ): Promise<IngredientStockCount> {
    const count = await this.findOne(id);
    if (count.status !== expected) {
      throw new BadRequestException(
        `Stock count ${id} is ${count.status}, expected ${expected}`,
      );
    }
    return count;
  }

  private async findItem(
    countId: number,
    itemId: number,
  ): Promise<IngredientStockCountItem> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId, ingredientStockCountId: countId },
    });
    if (!item) {
      throw new NotFoundException(
        `Stock count item ${itemId} not found on stock count ${countId}`,
      );
    }
    return item;
  }
}
