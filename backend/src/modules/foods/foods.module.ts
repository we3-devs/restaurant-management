import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddonGroupsModule } from '../addon-groups/addon-groups.module';
import { FoodCategoriesModule } from '../food-categories/food-categories.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { OutletsModule } from '../outlets/outlets.module';
import { UnitsModule } from '../units/units.module';
import { FoodAddonGroup } from './entities/food-addon-group.entity';
import { FoodOutlet } from './entities/food-outlet.entity';
import { FoodRecipe } from './entities/food-recipe.entity';
import { Food } from './entities/food.entity';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { SkuCompositionService } from './sku-composition.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Food, FoodOutlet, FoodAddonGroup, FoodRecipe]),
    FoodCategoriesModule,
    OutletsModule,
    AddonGroupsModule,
    IngredientsModule,
    UnitsModule,
  ],
  controllers: [FoodsController],
  providers: [FoodsService, SkuCompositionService],
  // SkuCompositionService is exported so FoodVariantsService can recompose the
  // tree too; FoodVariantsModule already imports this module.
  exports: [TypeOrmModule, FoodsService, SkuCompositionService],
})
export class FoodsModule {}
