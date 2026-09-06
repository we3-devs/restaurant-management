import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Addon } from '../addons/entities/addon.entity';
import { AddonGroup } from '../addon-groups/entities/addon-group.entity';
import { FoodCategory } from '../food-categories/entities/food-category.entity';
import { FoodAddonGroup } from '../foods/entities/food-addon-group.entity';
import { Food } from '../foods/entities/food.entity';
import { FoodVariant } from '../food-variants/entities/food-variant.entity';
import { SubVariant } from '../variants/entities/sub-variant.entity';
import { Variant } from '../variants/entities/variant.entity';
import { AuthModule } from '../auth/auth.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { WarehouseIngredientStock } from '../inventory-stock/entities/warehouse-ingredient-stock.entity';
import { FoodRecipe } from '../foods/entities/food-recipe.entity';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [AuthModule, WarehousesModule, TypeOrmModule.forFeature([Food, FoodCategory, FoodVariant, FoodRecipe, WarehouseIngredientStock, Variant, SubVariant, AddonGroup, Addon, FoodAddonGroup])],
  controllers: [MenuController],
  providers: [MenuService],
})
export class MenuModule {}
