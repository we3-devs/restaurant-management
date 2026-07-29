import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { ListInventoryTransactionsQueryDto } from './dto/list-inventory-transactions-query.dto';
import { ListWarehouseIngredientStocksQueryDto } from './dto/list-warehouse-ingredient-stocks-query.dto';
import {
  IngredientInventoryTransaction,
  InventoryTransactionType,
} from './entities/ingredient-inventory-transaction.entity';
import { WarehouseIngredientStock } from './entities/warehouse-ingredient-stock.entity';

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface ApplyMovementParams {
  warehouseId: number;
  ingredientId: number;
  /** Positive for a stock-in leg, negative for a stock-out leg. */
  quantityDelta: number;
  /** Unit cost of the movement; only used for stock-in legs (stock-out legs cost at the current average). */
  unitCost?: number;
  transactionType: InventoryTransactionType;
  referenceType: string;
  referenceId: number;
  createdBy: number | null;
  remarks?: string | null;
  /** Pass an existing manager to join an outer transaction (e.g. a transfer's two legs). */
  manager?: EntityManager;
}

@Injectable()
export class WarehouseIngredientStocksService {
  constructor(
    @InjectRepository(WarehouseIngredientStock)
    private readonly stocksRepository: Repository<WarehouseIngredientStock>,
    @InjectRepository(IngredientInventoryTransaction)
    private readonly transactionsRepository: Repository<IngredientInventoryTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: ListWarehouseIngredientStocksQueryDto,
  ): Promise<PaginatedResponse<WarehouseIngredientStock>> {
    const { page, limit, warehouseId, ingredientId } = query;
    const where: FindOptionsWhere<WarehouseIngredientStock> = {};
    if (warehouseId !== undefined) {
      where.warehouseId = warehouseId;
    }
    if (ingredientId !== undefined) {
      where.ingredientId = ingredientId;
    }

    const [data, total] = await this.stocksRepository.findAndCount({
      where,
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async listTransactions(
    query: ListInventoryTransactionsQueryDto,
  ): Promise<PaginatedResponse<IngredientInventoryTransaction>> {
    const { page, limit, warehouseId, ingredientId, transactionType } = query;
    const where: FindOptionsWhere<IngredientInventoryTransaction> = {};
    if (warehouseId !== undefined) {
      where.warehouseId = warehouseId;
    }
    if (ingredientId !== undefined) {
      where.ingredientId = ingredientId;
    }
    if (transactionType !== undefined) {
      where.transactionType = transactionType as InventoryTransactionType;
    }

    const [data, total] = await this.transactionsRepository.findAndCount({
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

  /**
   * Current stock row for one warehouse/ingredient pair, or a zero-quantity
   * virtual (unsaved) row if none exists yet. Used by Adjustments/Stock
   * Counts to snapshot a "system quantity" without posting a movement.
   */
  async getStock(
    warehouseId: number,
    ingredientId: number,
  ): Promise<WarehouseIngredientStock> {
    const stock = await this.stocksRepository.findOne({
      where: { warehouseId, ingredientId },
    });
    return (
      stock ??
      this.stocksRepository.create({
        warehouseId,
        ingredientId,
        quantity: 0,
        averageCost: 0,
        stockValue: 0,
      })
    );
  }

  /**
   * The single place every stock-movement document posts through: updates
   * (or creates) the warehouse/ingredient stock row using weighted-average
   * costing, writes the corresponding ledger row, and does both atomically.
   * Never called directly from a controller.
   */
  async applyMovement(
    params: ApplyMovementParams,
  ): Promise<WarehouseIngredientStock> {
    const run = async (manager: EntityManager) => {
      const stockRepo = manager.getRepository(WarehouseIngredientStock);
      const txnRepo = manager.getRepository(IngredientInventoryTransaction);

      let stock = await stockRepo.findOne({
        where: {
          warehouseId: params.warehouseId,
          ingredientId: params.ingredientId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!stock) {
        stock = await stockRepo.save(
          stockRepo.create({
            warehouseId: params.warehouseId,
            ingredientId: params.ingredientId,
            quantity: 0,
            averageCost: 0,
            stockValue: 0,
          }),
        );
      }

      let newQuantity: number;
      let newAverageCost = stock.averageCost;
      let effectiveUnitCost: number;

      if (params.quantityDelta > 0) {
        effectiveUnitCost = params.unitCost ?? 0;
        const existingValue = stock.quantity * stock.averageCost;
        const incomingValue = params.quantityDelta * effectiveUnitCost;
        newQuantity = round(stock.quantity + params.quantityDelta, 4);
        newAverageCost =
          newQuantity > 0
            ? round((existingValue + incomingValue) / newQuantity, 6)
            : 0;
      } else if (params.quantityDelta < 0) {
        effectiveUnitCost = stock.averageCost;
        newQuantity = round(stock.quantity + params.quantityDelta, 4);
        if (newQuantity < 0) {
          throw new BadRequestException(
            `Insufficient stock for ingredient ${params.ingredientId} at warehouse ${params.warehouseId}`,
          );
        }
      } else {
        effectiveUnitCost = 0;
        newQuantity = stock.quantity;
      }

      stock.quantity = newQuantity;
      stock.averageCost = newAverageCost;
      stock.stockValue = round(newQuantity * newAverageCost, 4);
      await stockRepo.save(stock);

      await txnRepo.save(
        txnRepo.create({
          ingredientId: params.ingredientId,
          warehouseId: params.warehouseId,
          ingredientBatchId: null,
          transactionType: params.transactionType,
          quantityIn: params.quantityDelta > 0 ? params.quantityDelta : 0,
          quantityOut: params.quantityDelta < 0 ? -params.quantityDelta : 0,
          balanceAfter: newQuantity,
          unitCost: effectiveUnitCost,
          totalCost: round(
            Math.abs(params.quantityDelta) * effectiveUnitCost,
            4,
          ),
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          remarks: params.remarks ?? null,
          createdBy: params.createdBy,
        }),
      );

      return stock;
    };

    if (params.manager) {
      return run(params.manager);
    }
    return this.dataSource.transaction((manager) => run(manager));
  }
}
