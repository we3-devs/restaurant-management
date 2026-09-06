import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { WarehousesService } from '../warehouses/warehouses.service';
import { ListInventoryTransactionsQueryDto } from './dto/list-inventory-transactions-query.dto';
import { ListWarehouseIngredientStocksQueryDto } from './dto/list-warehouse-ingredient-stocks-query.dto';
import { WarehouseIngredientStocksService } from './warehouse-ingredient-stocks.service';

@ApiTags('inventory-stock')
@ApiBearerAuth()
@Controller()
export class WarehouseIngredientStocksController {
  constructor(
    private readonly stocksService: WarehouseIngredientStocksService,
    private readonly warehousesService: WarehousesService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get('warehouse-ingredient-stocks')
  @RequirePermissions('inventory-stock.view')
  @ApiOperation({
    summary:
      'Lists current stock levels (paginated, optional warehouseId/ingredientId filters). Read-only — system-derived from stock-movement documents.',
  })
  async findAll(
    @Query() query: ListWarehouseIngredientStocksQueryDto,
    @CurrentUser() user: User,
  ) {
    const accessibleWarehouseIds = await this.resolveAccessibleWarehouseIds(
      query.warehouseId,
      user,
    );
    return this.stocksService.findAll(query, accessibleWarehouseIds);
  }

  /**
   * A specific warehouseId must belong to an outlet the caller can access;
   * with no warehouseId, restrict to every warehouse across the caller's
   * accessible outlets. Mirrors OrdersController.assertOrderAccess.
   */
  private async resolveAccessibleWarehouseIds(
    warehouseId: number | undefined,
    user: User,
  ): Promise<number[] | 'ALL'> {
    const accessibleOutletIds = await this.outletAccess.getAccessibleOutletIds(
      user.id,
      user.isSuperadmin,
    );
    if (warehouseId !== undefined) {
      const warehouse = await this.warehousesService.findOne(warehouseId);
      await this.outletAccess.assertOutletAccess(
        user.id,
        user.isSuperadmin,
        warehouse.outletId,
      );
      return [warehouseId];
    }
    if (accessibleOutletIds === 'ALL') {
      return 'ALL';
    }
    return this.warehousesService.findIdsForOutlets(accessibleOutletIds);
  }
}

@ApiTags('inventory-stock')
@ApiBearerAuth()
@Controller('inventory-transactions')
export class InventoryTransactionsController {
  constructor(
    private readonly stocksService: WarehouseIngredientStocksService,
    private readonly warehousesService: WarehousesService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get()
  @RequirePermissions('inventory-stock.view')
  @ApiOperation({
    summary:
      'Lists the inventory ledger (paginated, optional warehouseId/ingredientId/transactionType filters). Read-only, append-only.',
  })
  async findAll(
    @Query() query: ListInventoryTransactionsQueryDto,
    @CurrentUser() user: User,
  ) {
    const accessibleOutletIds = await this.outletAccess.getAccessibleOutletIds(
      user.id,
      user.isSuperadmin,
    );
    let accessibleWarehouseIds: number[] | 'ALL' = 'ALL';
    if (query.warehouseId !== undefined) {
      const warehouse = await this.warehousesService.findOne(
        query.warehouseId,
      );
      await this.outletAccess.assertOutletAccess(
        user.id,
        user.isSuperadmin,
        warehouse.outletId,
      );
      accessibleWarehouseIds = [query.warehouseId];
    } else if (accessibleOutletIds !== 'ALL') {
      accessibleWarehouseIds = await this.warehousesService.findIdsForOutlets(
        accessibleOutletIds,
      );
    }
    return this.stocksService.listTransactions(query, accessibleWarehouseIds);
  }
}
