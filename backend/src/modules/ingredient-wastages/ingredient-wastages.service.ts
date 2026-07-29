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
import { CreateIngredientWastageItemDto } from './dto/create-ingredient-wastage-item.dto';
import { CreateIngredientWastageDto } from './dto/create-ingredient-wastage.dto';
import { ListIngredientWastagesQueryDto } from './dto/list-ingredient-wastages-query.dto';
import { UpdateIngredientWastageItemDto } from './dto/update-ingredient-wastage-item.dto';
import { UpdateIngredientWastageDto } from './dto/update-ingredient-wastage.dto';
import { IngredientWastageItem } from './entities/ingredient-wastage-item.entity';
import { IngredientWastage } from './entities/ingredient-wastage.entity';

@Injectable()
export class IngredientWastagesService {
  constructor(
    @InjectRepository(IngredientWastage)
    private readonly wastagesRepository: Repository<IngredientWastage>,
    @InjectRepository(IngredientWastageItem)
    private readonly itemsRepository: Repository<IngredientWastageItem>,
    private readonly warehousesService: WarehousesService,
    private readonly ingredientsService: IngredientsService,
    private readonly warehouseIngredientStocksService: WarehouseIngredientStocksService,
  ) {}

  async findAll(
    query: ListIngredientWastagesQueryDto,
  ): Promise<PaginatedResponse<IngredientWastage>> {
    const { page, limit, warehouseId, status, search } = query;
    const where: FindOptionsWhere<IngredientWastage> = {};
    if (warehouseId !== undefined) {
      where.warehouseId = warehouseId;
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (search) {
      where.wastageNo = ILike(`%${search}%`);
    }

    const [data, total] = await this.wastagesRepository.findAndCount({
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

  async findOne(id: number): Promise<IngredientWastage> {
    const wastage = await this.wastagesRepository.findOne({ where: { id } });
    if (!wastage) {
      throw new NotFoundException(`Wastage ${id} not found`);
    }
    return wastage;
  }

  async create(
    dto: CreateIngredientWastageDto,
    createdBy: number,
  ): Promise<IngredientWastage> {
    await this.warehousesService.findOne(dto.warehouseId);

    return this.wastagesRepository.save(
      this.wastagesRepository.create({
        warehouseId: dto.warehouseId,
        wastageDate: dto.wastageDate,
        reason: dto.reason ?? 'other',
        remarks: dto.remarks ?? null,
        wastageNo: generateDocumentNumber('WST', dto.warehouseId),
        createdBy,
      }),
    );
  }

  async update(
    id: number,
    dto: UpdateIngredientWastageDto,
  ): Promise<IngredientWastage> {
    const wastage = await this.assertDraft(id);

    Object.assign(wastage, {
      ...(dto.wastageDate !== undefined && { wastageDate: dto.wastageDate }),
      ...(dto.reason !== undefined && { reason: dto.reason }),
      ...(dto.remarks !== undefined && { remarks: dto.remarks }),
    });
    return this.wastagesRepository.save(wastage);
  }

  async remove(id: number): Promise<void> {
    await this.assertDraft(id);
    await this.wastagesRepository.delete(id);
  }

  // ------------------------------------------------------------------ items

  async listItems(wastageId: number): Promise<IngredientWastageItem[]> {
    await this.findOne(wastageId);
    return this.itemsRepository.find({
      where: { ingredientWastageId: wastageId },
    });
  }

  async addItem(
    wastageId: number,
    dto: CreateIngredientWastageItemDto,
  ): Promise<IngredientWastageItem> {
    await this.assertDraft(wastageId);
    await this.ingredientsService.findOne(dto.ingredientId);

    return this.itemsRepository.save(
      this.itemsRepository.create({
        ingredientWastageId: wastageId,
        ingredientId: dto.ingredientId,
        ingredientBatchId: null,
        quantity: dto.quantity,
        unitCost: 0,
        totalCost: 0,
      }),
    );
  }

  async updateItem(
    wastageId: number,
    itemId: number,
    dto: UpdateIngredientWastageItemDto,
  ): Promise<IngredientWastageItem> {
    await this.assertDraft(wastageId);
    const item = await this.findItem(wastageId, itemId);

    if (dto.quantity !== undefined) {
      item.quantity = dto.quantity;
    }
    return this.itemsRepository.save(item);
  }

  async removeItem(wastageId: number, itemId: number): Promise<void> {
    await this.assertDraft(wastageId);
    const item = await this.findItem(wastageId, itemId);
    await this.itemsRepository.remove(item);
  }

  // --------------------------------------------------------------- terminal

  async approve(id: number, approvedBy: number): Promise<IngredientWastage> {
    const wastage = await this.assertDraft(id);
    const items = await this.itemsRepository.find({
      where: { ingredientWastageId: id },
    });
    if (items.length === 0) {
      throw new BadRequestException('Cannot approve a wastage with no items');
    }

    for (const item of items) {
      const stock = await this.warehouseIngredientStocksService.applyMovement({
        warehouseId: wastage.warehouseId,
        ingredientId: item.ingredientId,
        quantityDelta: -item.quantity,
        transactionType: 'wastage',
        referenceType: 'ingredient_wastage',
        referenceId: id,
        createdBy: approvedBy,
      });
      item.unitCost = stock.averageCost;
      item.totalCost =
        Math.round(item.quantity * stock.averageCost * 100) / 100;
      await this.itemsRepository.save(item);
    }

    wastage.status = 'approved';
    wastage.approvedBy = approvedBy;
    wastage.approvedAt = new Date();
    return this.wastagesRepository.save(wastage);
  }

  async cancel(id: number): Promise<IngredientWastage> {
    const wastage = await this.assertDraft(id);
    wastage.status = 'cancelled';
    return this.wastagesRepository.save(wastage);
  }

  // ----------------------------------------------------------------- private

  private async assertDraft(id: number): Promise<IngredientWastage> {
    const wastage = await this.findOne(id);
    if (wastage.status !== 'draft') {
      throw new BadRequestException(
        `Wastage ${id} is ${wastage.status}, not draft`,
      );
    }
    return wastage;
  }

  private async findItem(
    wastageId: number,
    itemId: number,
  ): Promise<IngredientWastageItem> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId, ingredientWastageId: wastageId },
    });
    if (!item) {
      throw new NotFoundException(
        `Wastage item ${itemId} not found on wastage ${wastageId}`,
      );
    }
    return item;
  }
}
