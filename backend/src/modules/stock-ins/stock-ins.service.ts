import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { IngredientsService } from '../ingredients/ingredients.service';
import { WarehouseIngredientStocksService } from '../inventory-stock/warehouse-ingredient-stocks.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateStockInItemDto } from './dto/create-stock-in-item.dto';
import { CreateStockInDto } from './dto/create-stock-in.dto';
import { ListStockInsQueryDto } from './dto/list-stock-ins-query.dto';
import { UpdateStockInItemDto } from './dto/update-stock-in-item.dto';
import { UpdateStockInDto } from './dto/update-stock-in.dto';
import { IngredientStockInItem } from './entities/ingredient-stock-in-item.entity';
import { IngredientStockIn } from './entities/ingredient-stock-in.entity';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class StockInsService {
  constructor(
    @InjectRepository(IngredientStockIn)
    private readonly stockInsRepository: Repository<IngredientStockIn>,
    @InjectRepository(IngredientStockInItem)
    private readonly itemsRepository: Repository<IngredientStockInItem>,
    private readonly warehousesService: WarehousesService,
    private readonly ingredientsService: IngredientsService,
    private readonly warehouseIngredientStocksService: WarehouseIngredientStocksService,
  ) {}

  async findAll(
    query: ListStockInsQueryDto,
    accessibleWarehouseIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<IngredientStockIn>> {
    const { page, limit, warehouseId, status, search } = query;
    const where: FindOptionsWhere<IngredientStockIn> = {};
    if (warehouseId !== undefined) {
      where.warehouseId = warehouseId;
    } else if (accessibleWarehouseIds !== 'ALL') {
      where.warehouseId = In(accessibleWarehouseIds);
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (search) {
      where.stockInNo = ILike(`%${search}%`);
    }

    const [data, total] = await this.stockInsRepository.findAndCount({
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

  async findOne(id: number): Promise<IngredientStockIn> {
    const stockIn = await this.stockInsRepository.findOne({ where: { id } });
    if (!stockIn) {
      throw new NotFoundException(`Stock-in ${id} not found`);
    }
    return stockIn;
  }

  async create(
    dto: CreateStockInDto,
    createdBy: number,
  ): Promise<IngredientStockIn> {
    await this.warehousesService.findOne(dto.warehouseId);

    return this.stockInsRepository.save(
      this.stockInsRepository.create({
        warehouseId: dto.warehouseId,
        stockInDate: dto.stockInDate,
        source: dto.source ?? 'other',
        remarks: dto.remarks ?? null,
        stockInNo: generateDocumentNumber('STIN', dto.warehouseId),
        createdBy,
      }),
    );
  }

  async update(id: number, dto: UpdateStockInDto): Promise<IngredientStockIn> {
    const stockIn = await this.assertDraft(id);

    Object.assign(stockIn, {
      ...(dto.stockInDate !== undefined && { stockInDate: dto.stockInDate }),
      ...(dto.source !== undefined && { source: dto.source }),
      ...(dto.remarks !== undefined && { remarks: dto.remarks }),
    });
    return this.stockInsRepository.save(stockIn);
  }

  async remove(id: number): Promise<void> {
    await this.assertDraft(id);
    await this.stockInsRepository.delete(id);
  }

  // ------------------------------------------------------------------ items

  async listItems(stockInId: number): Promise<IngredientStockInItem[]> {
    await this.findOne(stockInId);
    return this.itemsRepository.find({
      where: { ingredientStockInId: stockInId },
    });
  }

  async addItem(
    stockInId: number,
    dto: CreateStockInItemDto,
  ): Promise<IngredientStockInItem> {
    await this.assertDraft(stockInId);
    const ingredient = await this.ingredientsService.findOne(dto.ingredientId);
    this.ingredientsService.assertTrackable(ingredient);

    const unitCost = dto.unitCost ?? 0;
    return this.itemsRepository.save(
      this.itemsRepository.create({
        ingredientStockInId: stockInId,
        ingredientId: dto.ingredientId,
        ingredientBatchId: null,
        quantity: dto.quantity,
        unitCost,
        totalCost: round2(dto.quantity * unitCost),
      }),
    );
  }

  async updateItem(
    stockInId: number,
    itemId: number,
    dto: UpdateStockInItemDto,
  ): Promise<IngredientStockInItem> {
    await this.assertDraft(stockInId);
    const item = await this.findItem(stockInId, itemId);

    const quantity = dto.quantity ?? item.quantity;
    const unitCost = dto.unitCost ?? item.unitCost;
    item.quantity = quantity;
    item.unitCost = unitCost;
    item.totalCost = round2(quantity * unitCost);
    return this.itemsRepository.save(item);
  }

  async removeItem(stockInId: number, itemId: number): Promise<void> {
    await this.assertDraft(stockInId);
    const item = await this.findItem(stockInId, itemId);
    await this.itemsRepository.remove(item);
  }

  // --------------------------------------------------------------- terminal

  async approve(id: number, approvedBy: number): Promise<IngredientStockIn> {
    const stockIn = await this.assertDraft(id);
    const items = await this.itemsRepository.find({
      where: { ingredientStockInId: id },
    });
    if (items.length === 0) {
      throw new BadRequestException('Cannot approve a stock-in with no items');
    }

    for (const item of items) {
      await this.warehouseIngredientStocksService.applyMovement({
        warehouseId: stockIn.warehouseId,
        ingredientId: item.ingredientId,
        quantityDelta: item.quantity,
        unitCost: item.unitCost,
        transactionType: 'opening_stock',
        referenceType: 'stock_in',
        referenceId: id,
        createdBy: approvedBy,
      });
    }

    stockIn.status = 'approved';
    stockIn.approvedBy = approvedBy;
    stockIn.approvedAt = new Date();
    return this.stockInsRepository.save(stockIn);
  }

  async cancel(id: number): Promise<IngredientStockIn> {
    const stockIn = await this.assertDraft(id);
    stockIn.status = 'cancelled';
    return this.stockInsRepository.save(stockIn);
  }

  // ----------------------------------------------------------------- private

  private async assertDraft(id: number): Promise<IngredientStockIn> {
    const stockIn = await this.findOne(id);
    if (stockIn.status !== 'draft') {
      throw new BadRequestException(
        `Stock-in ${id} is ${stockIn.status}, not draft`,
      );
    }
    return stockIn;
  }

  private async findItem(
    stockInId: number,
    itemId: number,
  ): Promise<IngredientStockInItem> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId, ingredientStockInId: stockInId },
    });
    if (!item) {
      throw new NotFoundException(
        `Stock-in item ${itemId} not found on stock-in ${stockInId}`,
      );
    }
    return item;
  }
}
