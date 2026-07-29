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
import { CreateStockAdjustmentItemDto } from './dto/create-stock-adjustment-item.dto';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { ListStockAdjustmentsQueryDto } from './dto/list-stock-adjustments-query.dto';
import { UpdateStockAdjustmentItemDto } from './dto/update-stock-adjustment-item.dto';
import { UpdateStockAdjustmentDto } from './dto/update-stock-adjustment.dto';
import { StockAdjustmentsService } from './stock-adjustments.service';

@ApiTags('stock-adjustments')
@ApiBearerAuth()
@Controller('stock-adjustments')
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  @Get()
  @RequirePermissions('stock-adjustments.view')
  @ApiOperation({
    summary:
      'Lists stock adjustments (paginated, filter by warehouseId/status/search)',
  })
  findAll(@Query() query: ListStockAdjustmentsQueryDto) {
    return this.stockAdjustmentsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('stock-adjustments.view')
  @ApiOperation({ summary: 'Gets a stock adjustment' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stockAdjustmentsService.findOne(id);
  }

  @Post()
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({ summary: 'Creates a draft stock adjustment' })
  create(@Body() dto: CreateStockAdjustmentDto, @CurrentUser() user: User) {
    return this.stockAdjustmentsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({
    summary: 'Updates a draft stock adjustment (warehouseId is immutable)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockAdjustmentDto,
  ) {
    return this.stockAdjustmentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({ summary: 'Deletes a draft stock adjustment' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.stockAdjustmentsService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('stock-adjustments.view')
  @ApiOperation({ summary: "Lists a stock adjustment's items" })
  listItems(@Param('id', ParseIntPipe) id: number) {
    return this.stockAdjustmentsService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({
    summary:
      'Adds an item to a draft stock adjustment (systemQuantity is snapshotted automatically)',
  })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStockAdjustmentItemDto,
  ) {
    return this.stockAdjustmentsService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({ summary: 'Updates an item on a draft stock adjustment' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateStockAdjustmentItemDto,
  ) {
    return this.stockAdjustmentsService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({ summary: 'Removes an item from a draft stock adjustment' })
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.stockAdjustmentsService.removeItem(id, itemId);
  }

  @Post(':id/approve')
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({
    summary:
      'Approves a draft stock adjustment: posts adjustment_in/adjustment_out ledger entries for items with a nonzero difference and updates warehouse stock',
  })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.stockAdjustmentsService.approve(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock-adjustments.manage')
  @ApiOperation({
    summary: 'Cancels a draft stock adjustment (no ledger effect)',
  })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.stockAdjustmentsService.cancel(id);
  }
}
