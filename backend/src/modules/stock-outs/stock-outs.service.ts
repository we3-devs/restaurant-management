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
import { CreateStockOutItemDto } from './dto/create-stock-out-item.dto';
import { CreateStockOutDto } from './dto/create-stock-out.dto';
import { ListStockOutsQueryDto } from './dto/list-stock-outs-query.dto';
import { UpdateStockOutItemDto } from './dto/update-stock-out-item.dto';
import { UpdateStockOutDto } from './dto/update-stock-out.dto';
import { IngredientStockOutItem } from './entities/ingredient-stock-out-item.entity';
import { IngredientStockOut } from './entities/ingredient-stock-out.entity';

@Injectable()
export class StockOutsService {
  constructor(
    @InjectRepository(IngredientStockOut)
    private readonly stockOutsRepository: Repository<IngredientStockOut>,
    @InjectRepository(IngredientStockOutItem)
    private readonly itemsRepository: Repository<IngredientStockOutItem>,
    private readonly warehousesService: WarehousesService,
    private readonly ingredientsService: IngredientsService,
    private readonly warehouseIngredientStocksService: WarehouseIngredientStocksService,
  ) {}

  async findAll(
    query: ListStockOutsQueryDto,
  ): Promise<PaginatedResponse<IngredientStockOut>> {
    const { page, limit, warehouseId, status, search } = query;
    const where: FindOptionsWhere<IngredientStockOut> = {};
    if (warehouseId !== undefined) {
      where.warehouseId = warehouseId;
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (search) {
      where.stockOutNo = ILike(`%${search}%`);
    }

    const [data, total] = await this.stockOutsRepository.findAndCount({
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

  async findOne(id: number): Promise<IngredientStockOut> {
    const stockOut = await this.stockOutsRepository.findOne({ where: { id } });
    if (!stockOut) {
      throw new NotFoundException(`Stock-out ${id} not found`);
    }
    return stockOut;
  }

  async create(
    dto: CreateStockOutDto,
    createdBy: number,
  ): Promise<IngredientStockOut> {
    await this.warehousesService.findOne(dto.warehouseId);

    return this.stockOutsRepository.save(
      this.stockOutsRepository.create({
        warehouseId: dto.warehouseId,
        stockOutDate: dto.stockOutDate,
        purpose: dto.purpose ?? 'other',
        remarks: dto.remarks ?? null,
        stockOutNo: generateDocumentNumber('STOUT', dto.warehouseId),
        createdBy,
      }),
    );
  }

  async update(
    id: number,
    dto: UpdateStockOutDto,
  ): Promise<IngredientStockOut> {
    const stockOut = await this.assertDraft(id);

    Object.assign(stockOut, {
      ...(dto.stockOutDate !== undefined && { stockOutDate: dto.stockOutDate }),
      ...(dto.purpose !== undefined && { purpose: dto.purpose }),
      ...(dto.remarks !== undefined && { remarks: dto.remarks }),
    });
    return this.stockOutsRepository.save(stockOut);
  }

  async remove(id: number): Promise<void> {
    await this.assertDraft(id);
    await this.stockOutsRepository.delete(id);
  }

  // ------------------------------------------------------------------ items

  async listItems(stockOutId: number): Promise<IngredientStockOutItem[]> {
    await this.findOne(stockOutId);
    return this.itemsRepository.find({
      where: { ingredientStockOutId: stockOutId },
    });
  }

  async addItem(
    stockOutId: number,
    dto: CreateStockOutItemDto,
  ): Promise<IngredientStockOutItem> {
    await this.assertDraft(stockOutId);
    await this.ingredientsService.findOne(dto.ingredientId);

    return this.itemsRepository.save(
      this.itemsRepository.create({
        ingredientStockOutId: stockOutId,
        ingredientId: dto.ingredientId,
        ingredientBatchId: null,
        quantity: dto.quantity,
        unitCost: 0,
        totalCost: 0,
      }),
    );
  }

  async updateItem(
    stockOutId: number,
    itemId: number,
    dto: UpdateStockOutItemDto,
  ): Promise<IngredientStockOutItem> {
    await this.assertDraft(stockOutId);
    const item = await this.findItem(stockOutId, itemId);

    if (dto.quantity !== undefined) {
      item.quantity = dto.quantity;
    }
    return this.itemsRepository.save(item);
  }

  async removeItem(stockOutId: number, itemId: number): Promise<void> {
    await this.assertDraft(stockOutId);
    const item = await this.findItem(stockOutId, itemId);
    await this.itemsRepository.remove(item);
  }

  // --------------------------------------------------------------- terminal

  async approve(id: number, approvedBy: number): Promise<IngredientStockOut> {
    const stockOut = await this.assertDraft(id);
    const items = await this.itemsRepository.find({
      where: { ingredientStockOutId: id },
    });
    if (items.length === 0) {
      throw new BadRequestException('Cannot approve a stock-out with no items');
    }

    for (const item of items) {
      const stock = await this.warehouseIngredientStocksService.applyMovement({
        warehouseId: stockOut.warehouseId,
        ingredientId: item.ingredientId,
        quantityDelta: -item.quantity,
        transactionType: 'production_consume',
        referenceType: 'stock_out',
        referenceId: id,
        createdBy: approvedBy,
      });
      item.unitCost = stock.averageCost;
      item.totalCost =
        Math.round(item.quantity * stock.averageCost * 100) / 100;
      await this.itemsRepository.save(item);
    }

    stockOut.status = 'approved';
    stockOut.approvedBy = approvedBy;
    stockOut.approvedAt = new Date();
    return this.stockOutsRepository.save(stockOut);
  }

  async cancel(id: number): Promise<IngredientStockOut> {
    const stockOut = await this.assertDraft(id);
    stockOut.status = 'cancelled';
    return this.stockOutsRepository.save(stockOut);
  }

  // ----------------------------------------------------------------- private

  private async assertDraft(id: number): Promise<IngredientStockOut> {
    const stockOut = await this.findOne(id);
    if (stockOut.status !== 'draft') {
      throw new BadRequestException(
        `Stock-out ${id} is ${stockOut.status}, not draft`,
      );
    }
    return stockOut;
  }

  private async findItem(
    stockOutId: number,
    itemId: number,
  ): Promise<IngredientStockOutItem> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId, ingredientStockOutId: stockOutId },
    });
    if (!item) {
      throw new NotFoundException(
        `Stock-out item ${itemId} not found on stock-out ${stockOutId}`,
      );
    }
    return item;
  }
}
