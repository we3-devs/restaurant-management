import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodCategory } from './entities/food-category.entity';
import { FoodCategoriesController } from './food-categories.controller';
import { FoodCategoriesService } from './food-categories.service';

@Module({
  imports: [TypeOrmModule.forFeature([FoodCategory])],
  controllers: [FoodCategoriesController],
  providers: [FoodCategoriesService],
  exports: [TypeOrmModule, FoodCategoriesService],
})
export class FoodCategoriesModule {}
