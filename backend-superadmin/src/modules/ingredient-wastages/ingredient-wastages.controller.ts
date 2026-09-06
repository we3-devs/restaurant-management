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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { CreateIngredientWastageItemDto } from './dto/create-ingredient-wastage-item.dto';
import { CreateIngredientWastageDto } from './dto/create-ingredient-wastage.dto';
import { ListIngredientWastagesQueryDto } from './dto/list-ingredient-wastages-query.dto';
import { UpdateIngredientWastageItemDto } from './dto/update-ingredient-wastage-item.dto';
import { UpdateIngredientWastageDto } from './dto/update-ingredient-wastage.dto';
import { IngredientWastagesService } from './ingredient-wastages.service';

@ApiTags('ingredient-wastages')
@ApiBearerAuth()
@Controller('ingredient-wastages')
export class IngredientWastagesController {
  constructor(
    private readonly ingredientWastagesService: IngredientWastagesService,
  ) {}

  @Get()
  @RequirePermissions('ingredient-wastages.view')
  @ApiOperation({
    summary: 'Lists wastages (paginated, filter by warehouseId/status/search)',
  })
  findAll(@Query() query: ListIngredientWastagesQueryDto) {
    return this.ingredientWastagesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('ingredient-wastages.view')
  @ApiOperation({ summary: 'Gets a wastage' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientWastagesService.findOne(id);
  }

  @Post()
  @RequirePermissions('ingredient-wastages.manage')
  @ApiOperation({ summary: 'Creates a draft wastage' })
  create(@Body() dto: CreateIngredientWastageDto, @CurrentUser() user: User) {
    return this.ingredientWastagesService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('ingredient-wastages.manage')
  @ApiOperation({
    summary: 'Updates a draft wastage (warehouseId is immutable)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIngredientWastageDto,
  ) {
    return this.ingredientWastagesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('ingredient-wastages.manage')
  @ApiOperation({ summary: 'Deletes a draft wastage' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientWastagesService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('ingredient-wastages.view')
  @ApiOperation({ summary: "Lists a wastage's items" })
  listItems(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientWastagesService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('ingredient-wastages.manage')
  @ApiOperation({ summary: 'Adds an item to a draft wastage' })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateIngredientWastageItemDto,
  ) {
    return this.ingredientWastagesService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('ingredient-wastages.manage')
  @ApiOperation({ summary: 'Updates an item on a draft wastage' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateIngredientWastageItemDto,
  ) {
    return this.ingredientWastagesService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('ingredient-wastages.manage')
  @ApiOperation({ summary: 'Removes an item from a draft wastage' })
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.ingredientWastagesService.removeItem(id, itemId);
  }

  @Post(':id/approve')
  @RequirePermissions('ingredient-wastages.manage')
  @ApiOperation({
    summary:
      'Approves a draft wastage: posts a wastage ledger entry per item (priced at the current weighted-average cost) and updates warehouse stock',
  })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.ingredientWastagesService.approve(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('ingredient-wastages.manage')
  @ApiOperation({ summary: 'Cancels a draft wastage (no ledger effect)' })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientWastagesService.cancel(id);
  }
}
