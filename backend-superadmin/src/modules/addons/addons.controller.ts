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
import { AddonsService } from './addons.service';
import { CreateAddonRecipeDto } from './dto/create-addon-recipe.dto';
import { CreateAddonDto } from './dto/create-addon.dto';
import { ListAddonsQueryDto } from './dto/list-addons-query.dto';
import { UpdateAddonRecipeDto } from './dto/update-addon-recipe.dto';
import { UpdateAddonDto } from './dto/update-addon.dto';

@ApiTags('addons')
@ApiBearerAuth()
@Controller('addons')
export class AddonsController {
  constructor(private readonly addonsService: AddonsService) {}

  @Get()
  @RequirePermissions('addons.view')
  @ApiOperation({
    summary: 'Lists addons (paginated, optional search + addonGroupId filter)',
  })
  findAll(@Query() query: ListAddonsQueryDto) {
    return this.addonsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('addons.view')
  @ApiOperation({ summary: 'Gets an addon' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.addonsService.findOne(id);
  }

  @Post()
  @RequirePermissions('addons.manage')
  @ApiOperation({
    summary: 'Creates an addon (optionally under an addon group)',
  })
  create(@Body() dto: CreateAddonDto) {
    return this.addonsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('addons.manage')
  @ApiOperation({
    summary: 'Updates an addon (addonGroupId may be reassigned)',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAddonDto) {
    return this.addonsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('addons.manage')
  @ApiOperation({ summary: 'Soft-deletes an addon' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.addonsService.remove(id);
  }

  @Get(':id/recipes')
  @RequirePermissions('addons.view')
  @ApiOperation({ summary: 'Lists ingredient recipe rows for an addon' })
  listRecipes(@Param('id', ParseIntPipe) id: number) {
    return this.addonsService.listRecipes(id);
  }

  @Post(':id/recipes')
  @RequirePermissions('addons.manage')
  @ApiOperation({ summary: 'Adds an ingredient recipe row to an addon' })
  addRecipe(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAddonRecipeDto,
  ) {
    return this.addonsService.addRecipe(id, dto);
  }

  @Patch(':id/recipes/:recipeId')
  @RequirePermissions('addons.manage')
  @ApiOperation({
    summary:
      "Updates a recipe row's quantity/wastage/active flag (ingredientId/unitId are immutable)",
  })
  updateRecipe(
    @Param('id', ParseIntPipe) id: number,
    @Param('recipeId', ParseIntPipe) recipeId: number,
    @Body() dto: UpdateAddonRecipeDto,
  ) {
    return this.addonsService.updateRecipe(id, recipeId, dto);
  }

  @Delete(':id/recipes/:recipeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('addons.manage')
  @ApiOperation({ summary: 'Removes a recipe row from an addon' })
  removeRecipe(
    @Param('id', ParseIntPipe) id: number,
    @Param('recipeId', ParseIntPipe) recipeId: number,
  ) {
    return this.addonsService.removeRecipe(id, recipeId);
  }
}
