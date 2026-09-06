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
import { CreateStockTransferItemDto } from './dto/create-stock-transfer-item.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { ListStockTransfersQueryDto } from './dto/list-stock-transfers-query.dto';
import { UpdateStockTransferItemDto } from './dto/update-stock-transfer-item.dto';
import { UpdateStockTransferDto } from './dto/update-stock-transfer.dto';
import { IngredientStockTransfer } from './entities/ingredient-stock-transfer.entity';
import { StockTransfersService } from './stock-transfers.service';

@ApiTags('stock-transfers')
@ApiBearerAuth()
@Controller('stock-transfers')
export class StockTransfersController {
  constructor(
    private readonly stockTransfersService: StockTransfersService,
    private readonly warehousesService: WarehousesService,
    private readonly outletAccess: OutletAccessService,
  ) {}

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

  /**
   * A transfer moves stock out of one outlet and into another, so both legs
   * must be within the caller's access — otherwise a user could dispatch
   * stock away from an outlet they don't control, or receive stock into one
   * they don't control.
   */
  private async assertAccess(
    id: number,
    user: User,
  ): Promise<IngredientStockTransfer> {
    const transfer = await this.stockTransfersService.findOne(id);
    await this.assertWarehouseAccess(transfer.fromWarehouseId, user);
    await this.assertWarehouseAccess(transfer.toWarehouseId, user);
    return transfer;
  }

  @Get()
  @RequirePermissions('stock-transfers.view')
  @ApiOperation({
    summary:
      'Lists stock transfers (paginated, filter by fromWarehouseId/toWarehouseId/status/search)',
  })
  async findAll(@Query() query: ListStockTransfersQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (query.fromWarehouseId !== undefined) {
      await this.assertWarehouseAccess(query.fromWarehouseId, user);
    }
    if (query.toWarehouseId !== undefined) {
      await this.assertWarehouseAccess(query.toWarehouseId, user);
    }
    if (query.fromWarehouseId !== undefined && query.toWarehouseId !== undefined) {
      return this.stockTransfersService.findAll(query);
    }
    const accessibleWarehouseIds =
      accessible === 'ALL' ? 'ALL' : await this.warehousesService.findIdsForOutlets(accessible);
    return this.stockTransfersService.findAll(query, accessibleWarehouseIds);
  }

  @Get(':id')
  @RequirePermissions('stock-transfers.view')
  @ApiOperation({ summary: 'Gets a stock transfer' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertAccess(id, user);
  }

  @Post()
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({ summary: 'Creates a draft stock transfer' })
  async create(@Body() dto: CreateStockTransferDto, @CurrentUser() user: User) {
    await this.assertWarehouseAccess(dto.fromWarehouseId, user);
    await this.assertWarehouseAccess(dto.toWarehouseId, user);
    return this.stockTransfersService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({
    summary:
      'Updates a draft stock transfer (fromWarehouseId/toWarehouseId are immutable)',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockTransferDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockTransfersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({ summary: 'Deletes a draft stock transfer' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockTransfersService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('stock-transfers.view')
  @ApiOperation({ summary: "Lists a stock transfer's items" })
  async listItems(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockTransfersService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({ summary: 'Adds an item to a draft stock transfer' })
  async addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStockTransferItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockTransfersService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({ summary: 'Updates an item on a draft stock transfer' })
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateStockTransferItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockTransfersService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({ summary: 'Removes an item from a draft stock transfer' })
  async removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: User,
  ) {
    await this.assertAccess(id, user);
    return this.stockTransfersService.removeItem(id, itemId);
  }

  @Post(':id/approve')
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({
    summary:
      'Approves a draft transfer: posts transfer_out at the source and transfer_in at the destination atomically, per item',
  })
  async approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockTransfersService.approve(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({
    summary: 'Cancels a draft stock transfer (no ledger effect)',
  })
  async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertAccess(id, user);
    return this.stockTransfersService.cancel(id);
  }
}
