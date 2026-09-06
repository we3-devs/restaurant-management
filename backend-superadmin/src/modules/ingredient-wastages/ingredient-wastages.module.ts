import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { IngredientWastageItem } from './entities/ingredient-wastage-item.entity';
import { IngredientWastage } from './entities/ingredient-wastage.entity';
import { IngredientWastagesController } from './ingredient-wastages.controller';
import { IngredientWastagesService } from './ingredient-wastages.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngredientWastage, IngredientWastageItem]),
    WarehousesModule,
    IngredientsModule,
    InventoryStockModule,
  ],
  controllers: [IngredientWastagesController],
  providers: [IngredientWastagesService],
  exports: [TypeOrmModule, IngredientWastagesService],
})
export class IngredientWastagesModule {}
