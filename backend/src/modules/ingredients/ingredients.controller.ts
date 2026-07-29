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
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { ListIngredientsQueryDto } from './dto/list-ingredients-query.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { IngredientsService } from './ingredients.service';

@ApiTags('ingredients')
@ApiBearerAuth()
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  @RequirePermissions('ingredients.view')
  @ApiOperation({
    summary:
      'Lists ingredients (paginated, optional search + ingredientCategoryId/type filters)',
  })
  findAll(@Query() query: ListIngredientsQueryDto) {
    return this.ingredientsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('ingredients.view')
  @ApiOperation({ summary: 'Gets an ingredient' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientsService.findOne(id);
  }

  @Post()
  @RequirePermissions('ingredients.manage')
  @ApiOperation({ summary: 'Creates an ingredient' })
  create(@Body() dto: CreateIngredientDto) {
    return this.ingredientsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('ingredients.manage')
  @ApiOperation({ summary: 'Updates an ingredient (baseUnitId is immutable)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIngredientDto,
  ) {
    return this.ingredientsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('ingredients.manage')
  @ApiOperation({ summary: 'Soft-deletes an ingredient' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientsService.remove(id);
  }
}
