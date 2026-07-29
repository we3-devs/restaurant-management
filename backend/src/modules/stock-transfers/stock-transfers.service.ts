import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { IngredientsService } from '../ingredients/ingredients.service';
import { WarehouseIngredientStocksService } from '../inventory-stock/warehouse-ingredient-stocks.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateStockTransferItemDto } from './dto/create-stock-transfer-item.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { ListStockTransfersQueryDto } from './dto/list-stock-transfers-query.dto';
import { UpdateStockTransferItemDto } from './dto/update-stock-transfer-item.dto';
import { UpdateStockTransferDto } from './dto/update-stock-transfer.dto';
import { IngredientStockTransferItem } from './entities/ingredient-stock-transfer-item.entity';
import { IngredientStockTransfer } from './entities/ingredient-stock-transfer.entity';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class StockTransfersService {
  constructor(
    @InjectRepository(IngredientStockTransfer)
    private readonly transfersRepository: Repository<IngredientStockTransfer>,
    @InjectRepository(IngredientStockTransferItem)
    private readonly itemsRepository: Repository<IngredientStockTransferItem>,
    private readonly warehousesService: WarehousesService,
    private readonly ingredientsService: IngredientsService,
    private readonly warehouseIngredientStocksService: WarehouseIngredientStocksService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: ListStockTransfersQueryDto,
  ): Promise<PaginatedResponse<IngredientStockTransfer>> {
    const { page, limit, fromWarehouseId, toWarehouseId, status, search } =
      query;
    const where: FindOptionsWhere<IngredientStockTransfer> = {};
    if (fromWarehouseId !== undefined) {
      where.fromWarehouseId = fromWarehouseId;
    }
    if (toWarehouseId !== undefined) {
      where.toWarehouseId = toWarehouseId;
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (search) {
      where.transferNo = ILike(`%${search}%`);
    }

    const [data, total] = await this.transfersRepository.findAndCount({
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

  async findOne(id: number): Promise<IngredientStockTransfer> {
    const transfer = await this.transfersRepository.findOne({ where: { id } });
    if (!transfer) {
      throw new NotFoundException(`Stock transfer ${id} not found`);
    }
    return transfer;
  }

  async create(
    dto: CreateStockTransferDto,
    createdBy: number,
  ): Promise<IngredientStockTransfer> {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException(
        'fromWarehouseId and toWarehouseId must be different',
      );
    }
    await this.warehousesService.findOne(dto.fromWarehouseId);
    await this.warehousesService.findOne(dto.toWarehouseId);

    return this.transfersRepository.save(
      this.transfersRepository.create({
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        transferDate: dto.transferDate,
        remarks: dto.remarks ?? null,
        transferNo: generateDocumentNumber('TRF', dto.fromWarehouseId),
        requestedBy: createdBy,
      }),
    );
  }

  async update(
    id: number,
    dto: UpdateStockTransferDto,
  ): Promise<IngredientStockTransfer> {
    const transfer = await this.assertDraft(id);

    Object.assign(transfer, {
      ...(dto.transferDate !== undefined && { transferDate: dto.transferDate }),
      ...(dto.remarks !== undefined && { remarks: dto.remarks }),
    });
    return this.transfersRepository.save(transfer);
  }

  async remove(id: number): Promise<void> {
    await this.assertDraft(id);
    await this.transfersRepository.delete(id);
  }

  // ------------------------------------------------------------------ items

  async listItems(transferId: number): Promise<IngredientStockTransferItem[]> {
    await this.findOne(transferId);
    return this.itemsRepository.find({
      where: { ingredientStockTransferId: transferId },
    });
  }

  async addItem(
    transferId: number,
    dto: CreateStockTransferItemDto,
  ): Promise<IngredientStockTransferItem> {
    await this.assertDraft(transferId);
    await this.ingredientsService.findOne(dto.ingredientId);

    return this.itemsRepository.save(
      this.itemsRepository.create({
        ingredientStockTransferId: transferId,
        ingredientId: dto.ingredientId,
        ingredientBatchId: null,
        requestedQuantity: dto.quantity,
        dispatchedQuantity: 0,
        receivedQuantity: 0,
        unitCost: 0,
        totalCost: 0,
        remarks: dto.remarks ?? null,
      }),
    );
  }

  async updateItem(
    transferId: number,
    itemId: number,
    dto: UpdateStockTransferItemDto,
  ): Promise<IngredientStockTransferItem> {
    await this.assertDraft(transferId);
    const item = await this.findItem(transferId, itemId);

    if (dto.quantity !== undefined) {
      item.requestedQuantity = dto.quantity;
    }
    return this.itemsRepository.save(item);
  }

  async removeItem(transferId: number, itemId: number): Promise<void> {
    await this.assertDraft(transferId);
    const item = await this.findItem(transferId, itemId);
    await this.itemsRepository.remove(item);
  }

  // --------------------------------------------------------------- terminal

  async approve(
    id: number,
    approvedBy: number,
  ): Promise<IngredientStockTransfer> {
    const transfer = await this.assertDraft(id);
    const items = await this.itemsRepository.find({
      where: { ingredientStockTransferId: id },
    });
    if (items.length === 0) {
      throw new BadRequestException('Cannot approve a transfer with no items');
    }

    await this.dataSource.transaction(async (manager) => {
      for (const item of items) {
        const sourceStock =
          await this.warehouseIngredientStocksService.applyMovement({
            warehouseId: transfer.fromWarehouseId,
            ingredientId: item.ingredientId,
            quantityDelta: -item.requestedQuantity,
            transactionType: 'transfer_out',
            referenceType: 'stock_transfer',
            referenceId: id,
            createdBy: approvedBy,
            manager,
          });
        await this.warehouseIngredientStocksService.applyMovement({
          warehouseId: transfer.toWarehouseId,
          ingredientId: item.ingredientId,
          quantityDelta: item.requestedQuantity,
          unitCost: sourceStock.averageCost,
          transactionType: 'transfer_in',
          referenceType: 'stock_transfer',
          referenceId: id,
          createdBy: approvedBy,
          manager,
        });

        item.dispatchedQuantity = item.requestedQuantity;
        item.receivedQuantity = item.requestedQuantity;
        item.unitCost = sourceStock.averageCost;
        item.totalCost = round2(
          item.requestedQuantity * sourceStock.averageCost,
        );
        await manager.save(IngredientStockTransferItem, item);
      }

      transfer.status = 'approved';
      transfer.approvedBy = approvedBy;
      transfer.approvedAt = new Date();
      await manager.save(IngredientStockTransfer, transfer);
    });

    return this.findOne(id);
  }

  async cancel(id: number): Promise<IngredientStockTransfer> {
    const transfer = await this.assertDraft(id);
    transfer.status = 'cancelled';
    return this.transfersRepository.save(transfer);
  }

  // ----------------------------------------------------------------- private

  private async assertDraft(id: number): Promise<IngredientStockTransfer> {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'draft') {
      throw new BadRequestException(
        `Stock transfer ${id} is ${transfer.status}, not draft`,
      );
    }
    return transfer;
  }

  private async findItem(
    transferId: number,
    itemId: number,
  ): Promise<IngredientStockTransferItem> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId, ingredientStockTransferId: transferId },
    });
    if (!item) {
      throw new NotFoundException(
        `Stock transfer item ${itemId} not found on transfer ${transferId}`,
      );
    }
    return item;
  }
}
