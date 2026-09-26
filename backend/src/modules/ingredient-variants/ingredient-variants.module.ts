import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { StockInsModule } from '../stock-ins/stock-ins.module';
import { IngredientVariantPortion } from './entities/ingredient-variant-portion.entity';
import { IngredientVariant } from './entities/ingredient-variant.entity';
import { IngredientVariantsController } from './ingredient-variants.controller';
import { IngredientVariantsService } from './ingredient-variants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngredientVariant, IngredientVariantPortion]),
    IngredientsModule,
    StockInsModule,
  ],
  controllers: [IngredientVariantsController],
  providers: [IngredientVariantsService],
  exports: [TypeOrmModule, IngredientVariantsService],
})
export class IngredientVariantsModule {}
