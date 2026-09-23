import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { IngredientCategoriesModule } from '../ingredient-categories/ingredient-categories.module';
import { InventoryStockModule } from '../inventory-stock/inventory-stock.module';
import { OutletsModule } from '../outlets/outlets.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { UnitsModule } from '../units/units.module';
import { Ingredient } from './entities/ingredient.entity';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';
import { IngredientsImporter } from './import/ingredients-importer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ingredient]),
    AuthModule,
    OutletsModule,
    UnitsModule,
    IngredientCategoriesModule,
    // The importer resolves warehouses by name and posts opening stock
    // through the ledger service. The stock-in document rows it writes go
    // through the engine's EntityManager, so those entities need no module.
    WarehousesModule,
    forwardRef(() => InventoryStockModule),
  ],
  controllers: [IngredientsController],
  providers: [IngredientsService, IngredientsImporter],
  exports: [TypeOrmModule, IngredientsService, IngredientsImporter],
})
export class IngredientsModule {}
