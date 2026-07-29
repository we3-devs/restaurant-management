import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodsModule } from '../foods/foods.module';
import { OutletsModule } from '../outlets/outlets.module';
import { FoodVariantOutlet } from './entities/food-variant-outlet.entity';
import { FoodVariant } from './entities/food-variant.entity';
import { FoodVariantsController } from './food-variants.controller';
import { FoodVariantsService } from './food-variants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FoodVariant, FoodVariantOutlet]),
    FoodsModule,
    OutletsModule,
  ],
  controllers: [FoodVariantsController],
  providers: [FoodVariantsService],
  exports: [TypeOrmModule, FoodVariantsService],
})
export class FoodVariantsModule {}
