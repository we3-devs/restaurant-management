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
import { CreateStockCountItemDto } from './dto/create-stock-count-item.dto';
import { CreateStockCountDto } from './dto/create-stock-count.dto';
import { ListStockCountsQueryDto } from './dto/list-stock-counts-query.dto';
import { UpdateStockCountItemDto } from './dto/update-stock-count-item.dto';
import { UpdateStockCountDto } from './dto/update-stock-count.dto';
import { StockCountsService } from './stock-counts.service';

@ApiTags('stock-counts')
@ApiBearerAuth()
@Controller('stock-counts')
export class StockCountsController {
  constructor(private readonly stockCountsService: StockCountsService) {}

  @Get()
  @RequirePermissions('stock-counts.view')
  @ApiOperation({
    summary:
      'Lists stock counts (paginated, filter by warehouseId/status/search)',
  })
  findAll(@Query() query: ListStockCountsQueryDto) {
    return this.stockCountsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('stock-counts.view')
  @ApiOperation({ summary: 'Gets a stock count' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stockCountsService.findOne(id);
  }

  @Post()
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({ summary: 'Creates a draft stock count' })
  create(@Body() dto: CreateStockCountDto, @CurrentUser() user: User) {
    return this.stockCountsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({
    summary: 'Updates a draft stock count (warehouseId is immutable)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockCountDto,
  ) {
    return this.stockCountsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({ summary: 'Deletes a draft stock count' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.stockCountsService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('stock-counts.view')
  @ApiOperation({ summary: "Lists a stock count's items" })
  listItems(@Param('id', ParseIntPipe) id: number) {
    return this.stockCountsService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({ summary: 'Adds a counted item to a draft stock count' })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStockCountItemDto,
  ) {
    return this.stockCountsService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({ summary: 'Updates an item on a draft stock count' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateStockCountItemDto,
  ) {
    return this.stockCountsService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({ summary: 'Removes an item from a draft stock count' })
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.stockCountsService.removeItem(id, itemId);
  }

  @Post(':id/complete')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({
    summary:
      'Completes a draft stock count: snapshots systemQuantity from current stock and computes differences per item (no ledger effect yet)',
  })
  complete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.stockCountsService.complete(id, user.id);
  }

  @Post(':id/adjust')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({
    summary:
      "Posts a completed stock count's differences to the ledger (stock_count_gain/loss per item) and updates warehouse stock",
  })
  postAdjustments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.stockCountsService.postAdjustments(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock-counts.manage')
  @ApiOperation({
    summary: 'Cancels a draft or completed stock count (no ledger effect)',
  })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.stockCountsService.cancel(id);
  }
}
