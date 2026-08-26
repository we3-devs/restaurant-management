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
import { CreateStockInItemDto } from './dto/create-stock-in-item.dto';
import { CreateStockInDto } from './dto/create-stock-in.dto';
import { ListStockInsQueryDto } from './dto/list-stock-ins-query.dto';
import { UpdateStockInItemDto } from './dto/update-stock-in-item.dto';
import { UpdateStockInDto } from './dto/update-stock-in.dto';
import { IngredientStockIn } from './entities/ingredient-stock-in.entity';
import { StockInsService } from './stock-ins.service';

@ApiTags('stock-ins')
@ApiBearerAuth()
@Controller('stock-ins')
export class StockInsController {
  constructor(
    private readonly stockInsService: StockInsService,
    private readonly warehousesService: WarehousesService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  /** Resolves the stock-in's warehouse and asserts outlet access — same choke-point pattern as WarehousesController. */
  private async assertAccess(
    id: number,
    user: User,
  ): Promise<IngredientStockIn> {
    const stockIn = await this.stockInsService.findOne(id);
    const warehouse = await this.warehousesService.findOne(stockIn.warehouseId);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      warehouse.outletId,
    );
    return stockIn;
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
  @RequirePermissions('stock-ins.view')
  @ApiOperation({
    summary: 'Lists stock-ins (paginated, filter by warehouseId/status/search)',
  })
  async findAll(@Query() query: ListStockInsQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (query.warehouseId !== undefined) {
      await this.assertWarehouseAccess(query.warehouseId, user);
      return this.stockInsService.findAll(query);
    }
    const accessibleWarehouseIds =
      accessible === 'ALL' ? 'ALL' : await this.warehousesService.findIdsForOutlets(accessible);
    return this.stockInsService.findAll(query, accessibleWarehouseIds);
  }

  @Get(':id')
  @RequirePermissions('stock-ins.view')
  @ApiOperation({ summary: 'Gets a stock-in' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertAccess(id, user);
  }

  @Post()
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Creates a draft stock-in' })
  async create(@Body() dto: CreateStockInDto, @CurrentUser() user: User) {
    await this.assertWarehouseAccess(dto.warehouseId, user);
    return this.stockInsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({
    summary: 'Updates a draft stock-in (warehouseId is immutable)',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockInDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockInsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Deletes a draft stock-in' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockInsService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('stock-ins.view')
  @ApiOperation({ summary: "Lists a stock-in's items" })
  async listItems(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockInsService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Adds an item to a draft stock-in' })
  async addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStockInItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockInsService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Updates an item on a draft stock-in' })
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateStockInItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockInsService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Removes an item from a draft stock-in' })
  async removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockInsService.removeItem(id, itemId);
  }

  @Post(':id/approve')
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({
    summary:
      'Approves a draft stock-in: posts an opening_stock ledger entry per item and updates warehouse stock',
  })
  async approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockInsService.approve(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Cancels a draft stock-in (no ledger effect)' })
  async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockInsService.cancel(id);
  }
}
