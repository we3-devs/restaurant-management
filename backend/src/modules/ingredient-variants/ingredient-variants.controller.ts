import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { User } from '../users/entities/user.entity';
import { CreateIngredientVariantPortionDto } from './dto/create-ingredient-variant-portion.dto';
import { CreateIngredientVariantDto } from './dto/create-ingredient-variant.dto';
import { ReceiveVariantsStockDto } from './dto/receive-variants-stock.dto';
import { IngredientVariantsService } from './ingredient-variants.service';

@ApiTags('ingredient-variants')
@ApiBearerAuth()
@Controller()
export class IngredientVariantsController {
  constructor(private readonly ingredientVariantsService: IngredientVariantsService) {}

  @Get('ingredients/:id/variants')
  @RequirePermissions('ingredients.view')
  @ApiOperation({ summary: 'Lists the size variants of a base item' })
  listForParent(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientVariantsService.listForParent(id);
  }

  @Get('ingredient-variants')
  @RequirePermissions('ingredients.view')
  @ApiOperation({ summary: 'Lists the variant links for a given ingredient (which base items it belongs to)' })
  listForIngredient(@Query('ingredientId', ParseIntPipe) ingredientId: number) {
    return this.ingredientVariantsService.listForIngredient(ingredientId);
  }

  @Post('ingredients/:id/variants')
  @RequirePermissions('ingredients.manage')
  @ApiOperation({ summary: 'Adds a size variant to a base item' })
  addVariant(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateIngredientVariantDto) {
    return this.ingredientVariantsService.addVariant(id, dto);
  }

  @Delete('ingredients/:id/variants/:variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('ingredients.manage')
  @ApiOperation({ summary: 'Removes a variant (and its portions)' })
  removeVariant(
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
  ) {
    return this.ingredientVariantsService.removeVariant(id, variantId);
  }

  @Get('ingredients/:id/variants/:variantId/portions')
  @RequirePermissions('ingredients.view')
  @ApiOperation({ summary: 'Lists the sellable portions of a variant' })
  listPortions(
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
  ) {
    return this.ingredientVariantsService.listPortions(id, variantId);
  }

  @Post('ingredients/:id/variants/:variantId/portions')
  @RequirePermissions('ingredients.manage')
  @ApiOperation({ summary: 'Adds a sellable portion (e.g. quarter peg) to a variant' })
  addPortion(
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() dto: CreateIngredientVariantPortionDto,
  ) {
    return this.ingredientVariantsService.addPortion(id, variantId, dto);
  }

  @Delete('ingredients/:id/variants/:variantId/portions/:portionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('ingredients.manage')
  @ApiOperation({ summary: 'Removes a portion' })
  removePortion(
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Param('portionId', ParseIntPipe) portionId: number,
  ) {
    return this.ingredientVariantsService.removePortion(id, variantId, portionId);
  }

  @Post('ingredients/:id/variants/receive-stock')
  @RequirePermissions('ingredients.manage')
  @ApiOperation({
    summary:
      'Receives stock for several variants of this item at once (e.g. cartons of different sizes), in one saved batch',
  })
  receiveStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveVariantsStockDto,
    @CurrentUser() user: User,
  ) {
    return this.ingredientVariantsService.receiveStock(id, dto, user.id);
  }
}
