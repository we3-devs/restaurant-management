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
import { CreateStockOutItemDto } from './dto/create-stock-out-item.dto';
import { CreateStockOutDto } from './dto/create-stock-out.dto';
import { ListStockOutsQueryDto } from './dto/list-stock-outs-query.dto';
import { UpdateStockOutItemDto } from './dto/update-stock-out-item.dto';
import { UpdateStockOutDto } from './dto/update-stock-out.dto';
import { IngredientStockOut } from './entities/ingredient-stock-out.entity';
import { StockOutsService } from './stock-outs.service';

@ApiTags('stock-outs')
@ApiBearerAuth()
@Controller('stock-outs')
export class StockOutsController {
  constructor(
    private readonly stockOutsService: StockOutsService,
    private readonly warehousesService: WarehousesService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  private async assertAccess(
    id: number,
    user: User,
  ): Promise<IngredientStockOut> {
    const stockOut = await this.stockOutsService.findOne(id);
    const warehouse = await this.warehousesService.findOne(stockOut.warehouseId);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      warehouse.outletId,
    );
    return stockOut;
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
  @RequirePermissions('stock-outs.view')
  @ApiOperation({
    summary:
      'Lists stock-outs (paginated, filter by warehouseId/status/search)',
  })
  async findAll(@Query() query: ListStockOutsQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (query.warehouseId !== undefined) {
      await this.assertWarehouseAccess(query.warehouseId, user);
      return this.stockOutsService.findAll(query);
    }
    const accessibleWarehouseIds =
      accessible === 'ALL' ? 'ALL' : await this.warehousesService.findIdsForOutlets(accessible);
    return this.stockOutsService.findAll(query, accessibleWarehouseIds);
  }

  @Get(':id')
  @RequirePermissions('stock-outs.view')
  @ApiOperation({ summary: 'Gets a stock-out' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertAccess(id, user);
  }

  @Post()
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Creates a draft stock-out' })
  async create(@Body() dto: CreateStockOutDto, @CurrentUser() user: User) {
    await this.assertWarehouseAccess(dto.warehouseId, user);
    return this.stockOutsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({
    summary: 'Updates a draft stock-out (warehouseId is immutable)',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockOutDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockOutsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Deletes a draft stock-out' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockOutsService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('stock-outs.view')
  @ApiOperation({ summary: "Lists a stock-out's items" })
  async listItems(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockOutsService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Adds an item to a draft stock-out' })
  async addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStockOutItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockOutsService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Updates an item on a draft stock-out' })
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateStockOutItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockOutsService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Removes an item from a draft stock-out' })
  async removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockOutsService.removeItem(id, itemId);
  }

  @Post(':id/approve')
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({
    summary:
      'Approves a draft stock-out: posts a production_consume ledger entry per item (priced at the current weighted-average cost) and updates warehouse stock',
  })
  async approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockOutsService.approve(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Cancels a draft stock-out (no ledger effect)' })
  async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockOutsService.cancel(id);
  }
}
