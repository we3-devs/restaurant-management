import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateFoodCategoryDto } from './dto/create-food-category.dto';
import { ListFoodCategoriesQueryDto } from './dto/list-food-categories-query.dto';
import { UpdateFoodCategoryDto } from './dto/update-food-category.dto';
import { FoodCategoriesService } from './food-categories.service';

@ApiTags('food-categories')
@ApiBearerAuth()
@Controller('food-categories')
export class FoodCategoriesController {
  constructor(private readonly foodCategoriesService: FoodCategoriesService) {}

  @Get()
  @RequirePermissions('food-categories.view')
  @ApiOperation({
    summary:
      'Lists food categories (paginated, optional search + parentId filter)',
  })
  findAll(@Query() query: ListFoodCategoriesQueryDto) {
    return this.foodCategoriesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('food-categories.view')
  @ApiOperation({ summary: 'Gets a food category' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.foodCategoriesService.findOne(id);
  }

  @Post()
  @RequirePermissions('food-categories.manage')
  @ApiOperation({ summary: 'Creates a food category' })
  create(@Body() dto: CreateFoodCategoryDto) {
    return this.foodCategoriesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('food-categories.manage')
  @ApiOperation({
    summary:
      'Updates a food category (slug is immutable; parentId may be reassigned)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFoodCategoryDto,
  ) {
    return this.foodCategoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('food-categories.manage')
  @ApiOperation({ summary: 'Soft-deletes a food category' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.foodCategoriesService.remove(id);
  }
}
