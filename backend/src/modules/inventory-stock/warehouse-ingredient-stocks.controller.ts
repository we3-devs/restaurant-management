import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ListInventoryTransactionsQueryDto } from './dto/list-inventory-transactions-query.dto';
import { ListWarehouseIngredientStocksQueryDto } from './dto/list-warehouse-ingredient-stocks-query.dto';
import { WarehouseIngredientStocksService } from './warehouse-ingredient-stocks.service';

@ApiTags('inventory-stock')
@ApiBearerAuth()
@Controller()
export class WarehouseIngredientStocksController {
  constructor(
    private readonly stocksService: WarehouseIngredientStocksService,
  ) {}

  @Get('warehouse-ingredient-stocks')
  @RequirePermissions('inventory-stock.view')
  @ApiOperation({
    summary:
      'Lists current stock levels (paginated, optional warehouseId/ingredientId filters). Read-only — system-derived from stock-movement documents.',
  })
  findAll(@Query() query: ListWarehouseIngredientStocksQueryDto) {
    return this.stocksService.findAll(query);
  }
}

@ApiTags('inventory-stock')
@ApiBearerAuth()
@Controller('inventory-transactions')
export class InventoryTransactionsController {
  constructor(
    private readonly stocksService: WarehouseIngredientStocksService,
  ) {}

  @Get()
  @RequirePermissions('inventory-stock.view')
  @ApiOperation({
    summary:
      'Lists the inventory ledger (paginated, optional warehouseId/ingredientId/transactionType filters). Read-only, append-only.',
  })
  findAll(@Query() query: ListInventoryTransactionsQueryDto) {
    return this.stocksService.listTransactions(query);
  }
}
