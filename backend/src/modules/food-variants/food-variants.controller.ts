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

  @Get(':id')
  @RequirePermissions('food-variants.view')
  @ApiOperation({ summary: 'Gets a food variant' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.foodVariantsService.findOne(id);
  }

  @Post()
  @RequirePermissions('food-variants.manage')
  @ApiOperation({
    summary:
      'Creates a food variant (setting isDefault unsets any other default for the same food)',
  })
  create(@Body() dto: CreateFoodVariantDto) {
    return this.foodVariantsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('food-variants.manage')
  @ApiOperation({ summary: 'Updates a food variant (foodId is immutable)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFoodVariantDto,
  ) {
    return this.foodVariantsService.update(id, dto);
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
