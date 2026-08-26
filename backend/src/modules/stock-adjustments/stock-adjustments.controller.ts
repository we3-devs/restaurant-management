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
import { CreateStockAdjustmentItemDto } from './dto/create-stock-adjustment-item.dto';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { ListStockAdjustmentsQueryDto } from './dto/list-stock-adjustments-query.dto';
import { UpdateStockAdjustmentItemDto } from './dto/update-stock-adjustment-item.dto';
import { UpdateStockAdjustmentDto } from './dto/update-stock-adjustment.dto';
import { IngredientStockAdjustment } from './entities/ingredient-stock-adjustment.entity';
import { StockAdjustmentsService } from './stock-adjustments.service';

@ApiTags('stock-adjustments')
@ApiBearerAuth()
@Controller('stock-adjustments')
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
    private readonly warehousesService: WarehousesService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  private async assertAccess(
    id: number,
    user: User,
  ): Promise<IngredientStockAdjustment> {
    const adjustment = await this.stockAdjustmentsService.findOne(id);
    const warehouse = await this.warehousesService.findOne(adjustment.warehouseId);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      warehouse.outletId,
    );
    return adjustment;
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
  @RequirePermissions('stock-adjustments.view')
  @ApiOperation({
    summary:
      'Lists stock adjustments (paginated, filter by warehouseId/status/search)',
  })
  async findAll(@Query() query: ListStockAdjustmentsQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (query.warehouseId !== undefined) {
      await this.assertWarehouseAccess(query.warehouseId, user);
      return this.stockAdjustmentsService.findAll(query);
    }
    const accessibleWarehouseIds =
      accessible === 'ALL' ? 'ALL' : await this.warehousesService.findIdsForOutlets(accessible);
    return this.stockAdjustmentsService.findAll(query, accessibleWarehouseIds);
  }

  @Get(':id')
  @RequirePermissions('stock-adjustments.view')
  @ApiOperation({ summary: 'Gets a stock adjustment' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertAccess(id, user);
  }

  @Post()
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({ summary: 'Creates a draft stock adjustment' })
  async create(@Body() dto: CreateStockAdjustmentDto, @CurrentUser() user: User) {
    await this.assertWarehouseAccess(dto.warehouseId, user);
    return this.stockAdjustmentsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({
    summary: 'Updates a draft stock adjustment (warehouseId is immutable)',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockAdjustmentDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockAdjustmentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({ summary: 'Deletes a draft stock adjustment' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockAdjustmentsService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('stock-adjustments.view')
  @ApiOperation({ summary: "Lists a stock adjustment's items" })
  async listItems(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockAdjustmentsService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({
    summary:
      'Adds an item to a draft stock adjustment (systemQuantity is snapshotted automatically)',
  })
  async addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStockAdjustmentItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockAdjustmentsService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({ summary: 'Updates an item on a draft stock adjustment' })
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateStockAdjustmentItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockAdjustmentsService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({ summary: 'Removes an item from a draft stock adjustment' })
  async removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockAdjustmentsService.removeItem(id, itemId);
  }

  @Post(':id/approve')
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({
    summary:
      'Approves a draft stock adjustment: posts adjustment_in/adjustment_out ledger entries for items with a nonzero difference and updates warehouse stock',
  })
  async approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockAdjustmentsService.approve(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({
    summary: 'Cancels a draft stock adjustment (no ledger effect)',
  })
  async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockAdjustmentsService.cancel(id);
  }
}
