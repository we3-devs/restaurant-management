import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { AssignAddonGroupDto } from './dto/assign-addon-group.dto';
import { CreateFoodRecipeDto } from './dto/create-food-recipe.dto';
import { CreateFoodDto } from './dto/create-food.dto';
import { ImportFoodsCommitDto } from './dto/import-foods-commit.dto';
import { ListFoodsQueryDto } from './dto/list-foods-query.dto';
import { RevalidateFoodsImportDto } from './dto/revalidate-foods-import.dto';
import { UpdateFoodRecipeDto } from './dto/update-food-recipe.dto';
import { UpdateFoodDto } from './dto/update-food.dto';
import { UpsertFoodOutletDto } from './dto/upsert-food-outlet.dto';
import { FoodsImportService } from './foods-import.service';
import { FoodsService } from './foods.service';

@ApiTags('foods')
@ApiBearerAuth()
@Controller('foods')
export class FoodsController {
  constructor(
    private readonly foodsService: FoodsService,
    private readonly foodsImportService: FoodsImportService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get()
  @RequirePermissions('foods.view')
  @ApiOperation({
    summary: 'Lists foods (paginated, optional search + foodCategoryId filter)',
  })
  findAll(@Query() query: ListFoodsQueryDto) {
    return this.foodsService.findAll(query);
  }

  // Must come before @Get(':id') — otherwise Nest/Express would try to
  // ParseIntPipe("public") as the :id param and 400 before this ever runs.
  @Public()
  @Get('public')
  @ApiOperation({
    summary:
      'Guest-facing menu listing for /guest ordering (active foods only, trimmed fields, no auth required)',
  })
  findAllPublic(@Query() query: ListFoodsQueryDto) {
    return this.foodsService.findAllPublic(query);
  }

  @Get(':id')
  @RequirePermissions('foods.view')
  @ApiOperation({ summary: 'Gets a food' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const food = await this.foodsService.findOne(id);
    return this.foodsService.toResponse(food);
  }

  @Post()
  @RequirePermissions('foods.manage')
  @ApiOperation({ summary: 'Creates a food' })
  async create(@Body() dto: CreateFoodDto) {
    const food = await this.foodsService.create(dto);
    return this.foodsService.toResponse(food);
  }

  @Patch(':id')
  @RequirePermissions('foods.manage')
  @ApiOperation({ summary: 'Updates a food (slug is immutable)' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFoodDto) {
    const food = await this.foodsService.update(id, dto);
    return this.foodsService.toResponse(food);
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
  async upsertOutletOverride(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertFoodOutletDto,
    @CurrentUser() user: User,
  ) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.foodsService.upsertOutletOverride(id, dto);
  }

  @Delete(':id/outlets/:outletId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('foods.manage')
  @ApiOperation({
    summary:
      'Removes an outlet override (reverts to available-everywhere-at-base-price)',
  })
  async removeOutletOverride(
    @Param('id', ParseIntPipe) id: number,
    @Param('outletId', ParseIntPipe) outletId: number,
    @CurrentUser() user: User,
  ) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, outletId);
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

  @Post('import/preview')
  @RequirePermissions('foods.manage')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Parses and validates an uploaded CSV/Excel file of menu items, without saving anything',
  })
  async previewImport(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A CSV or Excel file is required');
    }
    return this.foodsImportService.previewImport(
      file.buffer,
      file.mimetype,
      file.originalname,
    );
  }

  @Post('import/revalidate')
  @RequirePermissions('foods.manage')
  @ApiOperation({
    summary:
      'Re-runs import validation against hand-edited preview rows (slug/sku uniqueness, category lookup)',
  })
  revalidateImport(@Body() dto: RevalidateFoodsImportDto) {
    return this.foodsImportService.revalidateRows(dto.rows);
  }

  @Post('import/commit')
  @RequirePermissions('foods.manage')
  @ApiOperation({
    summary: 'Creates the foods from a previously previewed, corrected import',
  })
  commitImport(@Body() dto: ImportFoodsCommitDto) {
    return this.foodsImportService.commitImport(dto.rows);
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
