import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { WarehouseIngredientStock } from './entities/warehouse-ingredient-stock.entity';

const SCAN_INTERVAL_MS = 10 * 60_000;
const DEDUPE_WINDOW_MINUTES = 10;

interface LowStockRow {
  ingredientId: number;
  ingredientName: string;
  outletId: number;
  quantity: string;
  reorderLevel: string;
  minimumStock: string;
}

/**
 * Periodic sweep for low/out-of-stock ingredients. Lives here (rather than in
 * NotificationsModule) because it needs direct repository access to stock
 * levels — NotificationsModule stays a thin, generic feed so it doesn't have
 * to depend on every domain module.
 */
@Processor('inventory-alerts')
export class InventoryAlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoryAlertsProcessor.name);

  constructor(
    @InjectRepository(WarehouseIngredientStock)
    private readonly stockRepository: Repository<WarehouseIngredientStock>,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
  ) {
    super();
  }

  async process(job: Job): Promise<{ notified: number }> {
    this.logger.debug(`Running inventory alerts scan (job ${job.id})`);
    const rows = await this.stockRepository.manager
      .createQueryBuilder()
      .select('ingredient.id', 'ingredientId')
      .addSelect('ingredient.name', 'ingredientName')
      .addSelect('warehouse.outlet_id', 'outletId')
      .addSelect('stock.quantity', 'quantity')
      .addSelect('ingredient.reorder_level', 'reorderLevel')
      .addSelect('ingredient.minimum_stock', 'minimumStock')
      .from('warehouse_ingredient_stocks', 'stock')
      .innerJoin(
        'ingredients',
        'ingredient',
        'ingredient.id = stock.ingredient_id',
      )
      .innerJoin('warehouses', 'warehouse', 'warehouse.id = stock.warehouse_id')
      .where('ingredient.is_active = true')
      .andWhere(
        '(stock.quantity <= ingredient.reorder_level OR stock.quantity <= ingredient.minimum_stock)',
      )
      .getRawMany<LowStockRow>();

    let notified = 0;
    for (const row of rows) {
      const quantity = Number(row.quantity);
      const outOfStock = quantity <= 0;
      const type = outOfStock ? 'out_of_stock' : 'low_stock';
      const marker = `"ingredientId":${row.ingredientId}`;

      const alreadyNotified = await this.notificationsService.existsRecent(
        row.outletId,
        type,
        marker,
        DEDUPE_WINDOW_MINUTES,
      );
      if (alreadyNotified) {
        continue;
      }

      const notification = await this.notificationsService.create({
        outletId: row.outletId,
        type,
        priority: outOfStock ? 'urgent' : 'high',
        title: outOfStock
          ? `${row.ingredientName} is out of stock`
          : `${row.ingredientName} is running low`,
        body: `On hand: ${quantity} (reorder level ${row.reorderLevel})`,
        data: JSON.stringify({ ingredientId: row.ingredientId }),
      });
      this.gateway.notifyNotificationCreated(notification);
      notified += 1;
    }

    if (notified > 0) {
      this.logger.log(`Inventory scan flagged ${notified} ingredient(s)`);
    }
    return { notified };
  }
}

@Injectable()
export class InventoryAlertsScheduler implements OnModuleInit {
  constructor(@InjectQueue('inventory-alerts') private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'inventory-alerts-scan',
      { every: SCAN_INTERVAL_MS },
      { name: 'scan' },
    );
  }
}
