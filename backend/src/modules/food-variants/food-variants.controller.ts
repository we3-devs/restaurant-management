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
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateFoodVariantDto } from './dto/create-food-variant.dto';
import { ListFoodVariantsQueryDto } from './dto/list-food-variants-query.dto';
import { UpdateFoodVariantDto } from './dto/update-food-variant.dto';
import { UpsertFoodVariantOutletDto } from './dto/upsert-food-variant-outlet.dto';
import { FoodVariantsService } from './food-variants.service';

@ApiTags('food-variants')
@ApiBearerAuth()
@Controller('food-variants')
export class FoodVariantsController {
  constructor(private readonly foodVariantsService: FoodVariantsService) {}

  @Get()
  @RequirePermissions('food-variants.view')
  @ApiOperation({
    summary: 'Lists food variants (paginated, optional search + foodId filter)',
  })
  findAll(@Query() query: ListFoodVariantsQueryDto) {
    return this.foodVariantsService.findAll(query);
  }

  // Must come before @Get(':id') — see foods.controller.ts's same-shaped route.
  @Public()
  @Get('public')
  @ApiOperation({
    summary:
      'Guest-facing variant listing for /guest ordering (requires foodId, active variants only, no auth required)',
  })
  findAllPublic(@Query() query: ListFoodVariantsQueryDto) {
    return this.foodVariantsService.findAllPublic(query);
  }

  @Get(':id')
  @RequirePermissions('food-variants.view')
  @ApiOperation({ summary: 'Gets a food variant' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const variant = await this.foodVariantsService.findOne(id);
    return this.foodVariantsService.toResponse(variant);
  }

  @Post()
  @RequirePermissions('food-variants.manage')
  @ApiOperation({
    summary:
      'Creates a food variant (setting isDefault unsets any other default for the same food)',
  })
  async create(@Body() dto: CreateFoodVariantDto) {
    const variant = await this.foodVariantsService.create(dto);
    return this.foodVariantsService.toResponse(variant);
  }

  @Patch(':id')
  @RequirePermissions('food-variants.manage')
  @ApiOperation({ summary: 'Updates a food variant (foodId is immutable)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFoodVariantDto,
  ) {
    const variant = await this.foodVariantsService.update(id, dto);
    return this.foodVariantsService.toResponse(variant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('food-variants.manage')
  @ApiOperation({ summary: 'Soft-deletes a food variant' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.foodVariantsService.remove(id);
  }

  @Get(':id/outlets')
  @RequirePermissions('food-variants.view')
  @ApiOperation({ summary: 'Lists per-outlet overrides for a food variant' })
  listOutletOverrides(@Param('id', ParseIntPipe) id: number) {
    return this.foodVariantsService.listOutletOverrides(id);
  }

  @Post(':id/outlets')
  @RequirePermissions('food-variants.manage')
  @ApiOperation({
    summary:
      'Creates or updates the outlet override for a food variant (upsert)',
  })
  upsertOutletOverride(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertFoodVariantOutletDto,
  ) {
    return this.foodVariantsService.upsertOutletOverride(id, dto);
  }

  @Delete(':id/outlets/:outletId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('food-variants.manage')
  @ApiOperation({ summary: 'Removes an outlet override for a food variant' })
  removeOutletOverride(
    @Param('id', ParseIntPipe) id: number,
    @Param('outletId', ParseIntPipe) outletId: number,
  ) {
    return this.foodVariantsService.removeOutletOverride(id, outletId);
  }
}
