import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
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
import { FoodsController } from './foods.controller';
import { FoodsImportService } from './foods-import.service';
import { FoodsService } from './foods.service';
import { SkuCompositionService } from './sku-composition.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Food, FoodOutlet, FoodAddonGroup, FoodRecipe]),
    // Menu import files are small (a few hundred rows of text), so 5MB is
    // generous headroom without opening the door to large uploads.
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
    AuthModule,
    FoodCategoriesModule,
    OutletsModule,
    AddonGroupsModule,
    IngredientsModule,
    UnitsModule,
  ],
  controllers: [FoodsController],
  providers: [FoodsService, FoodsImportService, SkuCompositionService],
  // SkuCompositionService is exported so FoodVariantsService can recompose the
  // tree too; FoodVariantsModule already imports this module.
  exports: [TypeOrmModule, FoodsService, SkuCompositionService],
})
export class FoodsModule {}
