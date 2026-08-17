import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodVariant } from '../food-variants/entities/food-variant.entity';
import { FoodsModule } from '../foods/foods.module';
import { SubVariant } from './entities/sub-variant.entity';
import { Variant } from './entities/variant.entity';
import {
  SubVariantsController,
  VariantsController,
} from './variants.controller';
import { VariantsService } from './variants.service';

@Module({
  // FoodVariant is registered here only so deletes can be refused while food
  // items still reference a list value; it stays owned by FoodVariantsModule.
  imports: [
    TypeOrmModule.forFeature([Variant, SubVariant, FoodVariant]),
    // For SkuCompositionService: renaming a list value rewrites the codes of
    // every food item using it.
    FoodsModule,
  ],
  controllers: [VariantsController, SubVariantsController],
  providers: [VariantsService],
  exports: [TypeOrmModule, VariantsService],
})
export class VariantsModule {}
