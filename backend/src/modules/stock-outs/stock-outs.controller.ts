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
import { CreateStockOutItemDto } from './dto/create-stock-out-item.dto';
import { CreateStockOutDto } from './dto/create-stock-out.dto';
import { ListStockOutsQueryDto } from './dto/list-stock-outs-query.dto';
import { UpdateStockOutItemDto } from './dto/update-stock-out-item.dto';
import { UpdateStockOutDto } from './dto/update-stock-out.dto';
import { StockOutsService } from './stock-outs.service';

@ApiTags('stock-outs')
@ApiBearerAuth()
@Controller('stock-outs')
export class StockOutsController {
  constructor(private readonly stockOutsService: StockOutsService) {}

  @Get()
  @RequirePermissions('stock-outs.view')
  @ApiOperation({
    summary:
      'Lists stock-outs (paginated, filter by warehouseId/status/search)',
  })
  findAll(@Query() query: ListStockOutsQueryDto) {
    return this.stockOutsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('stock-outs.view')
  @ApiOperation({ summary: 'Gets a stock-out' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stockOutsService.findOne(id);
  }

  @Post()
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Creates a draft stock-out' })
  create(@Body() dto: CreateStockOutDto, @CurrentUser() user: User) {
    return this.stockOutsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({
    summary: 'Updates a draft stock-out (warehouseId is immutable)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockOutDto,
  ) {
    return this.stockOutsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Deletes a draft stock-out' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.stockOutsService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('stock-outs.view')
  @ApiOperation({ summary: "Lists a stock-out's items" })
  listItems(@Param('id', ParseIntPipe) id: number) {
    return this.stockOutsService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Adds an item to a draft stock-out' })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStockOutItemDto,
  ) {
    return this.stockOutsService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Updates an item on a draft stock-out' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateStockOutItemDto,
  ) {
    return this.stockOutsService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Removes an item from a draft stock-out' })
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.stockOutsService.removeItem(id, itemId);
  }

  @Post(':id/approve')
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({
    summary:
      'Approves a draft stock-out: posts a production_consume ledger entry per item (priced at the current weighted-average cost) and updates warehouse stock',
  })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.stockOutsService.approve(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock-outs.manage')
  @ApiOperation({ summary: 'Cancels a draft stock-out (no ledger effect)' })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.stockOutsService.cancel(id);
  }
}
