import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IngredientInventoryTransaction } from './entities/ingredient-inventory-transaction.entity';
import { WarehouseIngredientStock } from './entities/warehouse-ingredient-stock.entity';
import {
  InventoryAlertsProcessor,
  InventoryAlertsScheduler,
} from './inventory-alerts.processor';
import {
  InventoryTransactionsController,
  WarehouseIngredientStocksController,
} from './warehouse-ingredient-stocks.controller';
import { WarehouseIngredientStocksService } from './warehouse-ingredient-stocks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarehouseIngredientStock,
      IngredientInventoryTransaction,
    ]),
    NotificationsModule,
    KitchenTicketsModule,
    BullModule.registerQueue({ name: 'inventory-alerts' }),
  ],
  controllers: [
    WarehouseIngredientStocksController,
    InventoryTransactionsController,
  ],
  providers: [
    WarehouseIngredientStocksService,
    InventoryAlertsProcessor,
    InventoryAlertsScheduler,
  ],
  exports: [TypeOrmModule, WarehouseIngredientStocksService],
})
export class InventoryStockModule {}
