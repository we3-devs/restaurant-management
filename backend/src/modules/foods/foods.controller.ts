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
import { AssignAddonGroupDto } from './dto/assign-addon-group.dto';
import { CreateFoodRecipeDto } from './dto/create-food-recipe.dto';
import { CreateFoodDto } from './dto/create-food.dto';
import { ListFoodsQueryDto } from './dto/list-foods-query.dto';
import { UpdateFoodRecipeDto } from './dto/update-food-recipe.dto';
import { UpdateFoodDto } from './dto/update-food.dto';
import { UpsertFoodOutletDto } from './dto/upsert-food-outlet.dto';
import { FoodsService } from './foods.service';

@ApiTags('foods')
@ApiBearerAuth()
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Get()
  @RequirePermissions('foods.view')
  @ApiOperation({
    summary: 'Lists foods (paginated, optional search + foodCategoryId filter)',
  })
  findAll(@Query() query: ListFoodsQueryDto) {
    return this.foodsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('foods.view')
  @ApiOperation({ summary: 'Gets a food' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.foodsService.findOne(id);
  }

  @Post()
  @RequirePermissions('foods.manage')
  @ApiOperation({ summary: 'Creates a food' })
  create(@Body() dto: CreateFoodDto) {
    return this.foodsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('foods.manage')
  @ApiOperation({ summary: 'Updates a food (slug is immutable)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFoodDto) {
    return this.foodsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('foods.manage')
  @ApiOperation({ summary: 'Soft-deletes a food' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.foodsService.remove(id);
  }

  @Get(':id/outlets')
  @RequirePermissions('foods.view')
  @ApiOperation({
    summary:
      'Lists per-outlet price/availability overrides for a food (absence of a row = available everywhere at base price)',
  })
  listOutletOverrides(@Param('id', ParseIntPipe) id: number) {
    return this.foodsService.listOutletOverrides(id);
  }

  @Post(':id/outlets')
  @RequirePermissions('foods.manage')
  @ApiOperation({
    summary: 'Creates or updates the outlet override for a food (upsert)',
  })
  upsertOutletOverride(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertFoodOutletDto,
  ) {
    return this.foodsService.upsertOutletOverride(id, dto);
  }

  @Delete(':id/outlets/:outletId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('foods.manage')
  @ApiOperation({
    summary:
      'Removes an outlet override (reverts to available-everywhere-at-base-price)',
  })
  removeOutletOverride(
    @Param('id', ParseIntPipe) id: number,
    @Param('outletId', ParseIntPipe) outletId: number,
  ) {
    return this.foodsService.removeOutletOverride(id, outletId);
  }

  @Get(':id/addon-groups')
  @RequirePermissions('foods.view')
  @ApiOperation({ summary: 'Lists addon groups assigned to a food' })
  listAddonGroups(@Param('id', ParseIntPipe) id: number) {
    return this.foodsService.listAddonGroups(id);
  }

  @Post(':id/addon-groups')
  @RequirePermissions('foods.manage')
  @ApiOperation({
    summary: 'Assigns an addon group to a food (idempotent)',
  })
  assignAddonGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignAddonGroupDto,
  ) {
    return this.foodsService.assignAddonGroup(id, dto);
  }

  @Delete(':id/addon-groups/:addonGroupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('foods.manage')
  @ApiOperation({ summary: 'Unassigns an addon group from a food' })
  unassignAddonGroup(
    @Param('id', ParseIntPipe) id: number,
    @Param('addonGroupId', ParseIntPipe) addonGroupId: number,
  ) {
    return this.foodsService.unassignAddonGroup(id, addonGroupId);
  }

  @Get(':id/recipes')
  @RequirePermissions('foods.view')
  @ApiOperation({
    summary:
      'Lists ingredient recipe rows for a food (variant-specific rows override food-level rows for the same ingredient)',
  })
  listRecipes(@Param('id', ParseIntPipe) id: number) {
    return this.foodsService.listRecipes(id);
  }

  @Post(':id/recipes')
  @RequirePermissions('foods.manage')
  @ApiOperation({ summary: 'Adds an ingredient recipe row to a food' })
  addRecipe(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFoodRecipeDto,
  ) {
    return this.foodsService.addRecipe(id, dto);
  }

  @Patch(':id/recipes/:recipeId')
  @RequirePermissions('foods.manage')
  @ApiOperation({
    summary:
      "Updates a recipe row's quantity/wastage/active flag (ingredientId/unitId/foodVariantId are immutable)",
  })
  updateRecipe(
    @Param('id', ParseIntPipe) id: number,
    @Param('recipeId', ParseIntPipe) recipeId: number,
    @Body() dto: UpdateFoodRecipeDto,
  ) {
    return this.foodsService.updateRecipe(id, recipeId, dto);
  }

  @Delete(':id/recipes/:recipeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('foods.manage')
  @ApiOperation({ summary: 'Removes a recipe row from a food' })
  removeRecipe(
    @Param('id', ParseIntPipe) id: number,
    @Param('recipeId', ParseIntPipe) recipeId: number,
  ) {
    return this.foodsService.removeRecipe(id, recipeId);
  }
}
