import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddonGroupsModule } from '../addon-groups/addon-groups.module';
import { FoodCategoriesModule } from '../food-categories/food-categories.module';
import { OutletsModule } from '../outlets/outlets.module';
import { FoodAddonGroup } from './entities/food-addon-group.entity';
import { FoodOutlet } from './entities/food-outlet.entity';
import { Food } from './entities/food.entity';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Food, FoodOutlet, FoodAddonGroup]),
    FoodCategoriesModule,
    OutletsModule,
    AddonGroupsModule,
  ],
  controllers: [FoodsController],
  providers: [FoodsService],
  exports: [TypeOrmModule, FoodsService],
})
export class FoodsModule {}
