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
import { CreateStockTransferItemDto } from './dto/create-stock-transfer-item.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { ListStockTransfersQueryDto } from './dto/list-stock-transfers-query.dto';
import { UpdateStockTransferItemDto } from './dto/update-stock-transfer-item.dto';
import { UpdateStockTransferDto } from './dto/update-stock-transfer.dto';
import { StockTransfersService } from './stock-transfers.service';

@ApiTags('stock-transfers')
@ApiBearerAuth()
@Controller('stock-transfers')
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  @Get()
  @RequirePermissions('stock-transfers.view')
  @ApiOperation({
    summary:
      'Lists stock transfers (paginated, filter by fromWarehouseId/toWarehouseId/status/search)',
  })
  findAll(@Query() query: ListStockTransfersQueryDto) {
    return this.stockTransfersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('stock-transfers.view')
  @ApiOperation({ summary: 'Gets a stock transfer' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stockTransfersService.findOne(id);
  }

  @Post()
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({ summary: 'Creates a draft stock transfer' })
  create(@Body() dto: CreateStockTransferDto, @CurrentUser() user: User) {
    return this.stockTransfersService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({
    summary:
      'Updates a draft stock transfer (fromWarehouseId/toWarehouseId are immutable)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockTransferDto,
  ) {
    return this.stockTransfersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({ summary: 'Deletes a draft stock transfer' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.stockTransfersService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('stock-transfers.view')
  @ApiOperation({ summary: "Lists a stock transfer's items" })
  listItems(@Param('id', ParseIntPipe) id: number) {
    return this.stockTransfersService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({ summary: 'Adds an item to a draft stock transfer' })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStockTransferItemDto,
  ) {
    return this.stockTransfersService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({ summary: 'Updates an item on a draft stock transfer' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateStockTransferItemDto,
  ) {
    return this.stockTransfersService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({ summary: 'Removes an item from a draft stock transfer' })
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.stockTransfersService.removeItem(id, itemId);
  }

  @Post(':id/approve')
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({
    summary:
      'Approves a draft transfer: posts transfer_out at the source and transfer_in at the destination atomically, per item',
  })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.stockTransfersService.approve(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock-transfers.manage')
  @ApiOperation({
    summary: 'Cancels a draft stock transfer (no ledger effect)',
  })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.stockTransfersService.cancel(id);
  }
}
