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
import { CreateIngredientCategoryDto } from './dto/create-ingredient-category.dto';
import { ListIngredientCategoriesQueryDto } from './dto/list-ingredient-categories-query.dto';
import { UpdateIngredientCategoryDto } from './dto/update-ingredient-category.dto';
import { IngredientCategoriesService } from './ingredient-categories.service';

@ApiTags('ingredient-categories')
@ApiBearerAuth()
@Controller('ingredient-categories')
export class IngredientCategoriesController {
  constructor(
    private readonly ingredientCategoriesService: IngredientCategoriesService,
  ) {}

  @Get()
  @RequirePermissions('ingredient-categories.view')
  @ApiOperation({
    summary:
      'Lists ingredient categories (paginated, optional search + parentId filter)',
  })
  findAll(@Query() query: ListIngredientCategoriesQueryDto) {
    return this.ingredientCategoriesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('ingredient-categories.view')
  @ApiOperation({ summary: 'Gets an ingredient category' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientCategoriesService.findOne(id);
  }

  @Post()
  @RequirePermissions('ingredient-categories.manage')
  @ApiOperation({ summary: 'Creates an ingredient category' })
  create(@Body() dto: CreateIngredientCategoryDto) {
    return this.ingredientCategoriesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('ingredient-categories.manage')
  @ApiOperation({
    summary:
      'Updates an ingredient category (slug is immutable; parentId may be reassigned)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIngredientCategoryDto,
  ) {
    return this.ingredientCategoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('ingredient-categories.manage')
  @ApiOperation({ summary: 'Soft-deletes an ingredient category' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientCategoriesService.remove(id);
  }
}
