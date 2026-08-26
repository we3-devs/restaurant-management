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
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateStockCountItemDto } from './dto/create-stock-count-item.dto';
import { CreateStockCountDto } from './dto/create-stock-count.dto';
import { ListStockCountsQueryDto } from './dto/list-stock-counts-query.dto';
import { UpdateStockCountItemDto } from './dto/update-stock-count-item.dto';
import { UpdateStockCountDto } from './dto/update-stock-count.dto';
import { IngredientStockCount } from './entities/ingredient-stock-count.entity';
import { StockCountsService } from './stock-counts.service';

@ApiTags('stock-counts')
@ApiBearerAuth()
@Controller('stock-counts')
export class StockCountsController {
  constructor(
    private readonly stockCountsService: StockCountsService,
    private readonly warehousesService: WarehousesService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  private async assertAccess(
    id: number,
    user: User,
  ): Promise<IngredientStockCount> {
    const count = await this.stockCountsService.findOne(id);
    const warehouse = await this.warehousesService.findOne(count.warehouseId);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      warehouse.outletId,
    );
    return count;
  }

  private async assertWarehouseAccess(
    warehouseId: number,
    user: User,
  ): Promise<void> {
    const warehouse = await this.warehousesService.findOne(warehouseId);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      warehouse.outletId,
    );
  }

  @Get()
  @RequirePermissions('stock-counts.view')
  @ApiOperation({
    summary:
      'Lists stock counts (paginated, filter by warehouseId/status/search)',
  })
  async findAll(@Query() query: ListStockCountsQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (query.warehouseId !== undefined) {
      await this.assertWarehouseAccess(query.warehouseId, user);
      return this.stockCountsService.findAll(query);
    }
    const accessibleWarehouseIds =
      accessible === 'ALL' ? 'ALL' : await this.warehousesService.findIdsForOutlets(accessible);
    return this.stockCountsService.findAll(query, accessibleWarehouseIds);
  }

  @Get(':id')
  @RequirePermissions('stock-counts.view')
  @ApiOperation({ summary: 'Gets a stock count' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertAccess(id, user);
  }

  @Post()
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({ summary: 'Creates a draft stock count' })
  async create(@Body() dto: CreateStockCountDto, @CurrentUser() user: User) {
    await this.assertWarehouseAccess(dto.warehouseId, user);
    return this.stockCountsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({
    summary: 'Updates a draft stock count (warehouseId is immutable)',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockCountDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockCountsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({ summary: 'Deletes a draft stock count' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockCountsService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('stock-counts.view')
  @ApiOperation({ summary: "Lists a stock count's items" })
  async listItems(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockCountsService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({ summary: 'Adds a counted item to a draft stock count' })
  async addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStockCountItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockCountsService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({ summary: 'Updates an item on a draft stock count' })
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateStockCountItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockCountsService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({ summary: 'Removes an item from a draft stock count' })
  async removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockCountsService.removeItem(id, itemId);
  }

  @Post(':id/complete')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({
    summary:
      'Completes a draft stock count: snapshots systemQuantity from current stock and computes differences per item (no ledger effect yet)',
  })
  async complete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockCountsService.complete(id, user.id);
  }

  @Post(':id/adjust')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({
    summary:
      "Posts a completed stock count's differences to the ledger (stock_count_gain/loss per item) and updates warehouse stock",
  })
  async postAdjustments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockCountsService.postAdjustments(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({
    summary: 'Cancels a draft or completed stock count (no ledger effect)',
  })
  async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockCountsService.cancel(id);
  }
}
