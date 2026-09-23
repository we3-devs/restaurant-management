import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddonGroupsModule } from '../addon-groups/addon-groups.module';
import { AuthModule } from '../auth/auth.module';
import { FoodCategoriesModule } from '../food-categories/food-categories.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { OutletsModule } from '../outlets/outlets.module';
import { UnitsModule } from '../units/units.module';
import { FoodAddonGroup } from './entities/food-addon-group.entity';
import { FoodOutlet } from './entities/food-outlet.entity';
import { FoodRecipe } from './entities/food-recipe.entity';
import { Food } from './entities/food.entity';
import { FoodVariant } from '../food-variants/entities/food-variant.entity';
import { FoodCategory } from '../food-categories/entities/food-category.entity';
import { Variant } from '../variants/entities/variant.entity';
import { SubVariant } from '../variants/entities/sub-variant.entity';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { SkuCompositionService } from './sku-composition.service';
import { FoodsImporter } from './import/foods-importer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Food, FoodOutlet, FoodAddonGroup, FoodRecipe, FoodVariant, FoodCategory, Variant, SubVariant]),
    AuthModule,
    FoodCategoriesModule,
    OutletsModule,
    AddonGroupsModule,
    // Circular: IngredientsModule -> InventoryStockModule -> KitchenTicketsModule
    // -> OrdersModule -> FoodsModule. Without forwardRef, IngredientsModule is
    // still mid-load when this decorator evaluates and resolves to `undefined`.
    forwardRef(() => IngredientsModule),
    UnitsModule,
  ],
  controllers: [FoodsController],
  providers: [FoodsService, SkuCompositionService, FoodsImporter],
  // SkuCompositionService is exported so FoodVariantsService can recompose the
  // tree too; FoodVariantsModule already imports this module.
  exports: [TypeOrmModule, FoodsService, SkuCompositionService, FoodsImporter],
})
export class FoodsModule {}
