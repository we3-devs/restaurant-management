import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientCategoriesModule } from '../ingredient-categories/ingredient-categories.module';
import { UnitsModule } from '../units/units.module';
import { Ingredient } from './entities/ingredient.entity';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ingredient]),
    UnitsModule,
    IngredientCategoriesModule,
  ],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [TypeOrmModule, IngredientsService],
})
export class IngredientsModule {}
