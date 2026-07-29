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
import { CreateStockInItemDto } from './dto/create-stock-in-item.dto';
import { CreateStockInDto } from './dto/create-stock-in.dto';
import { ListStockInsQueryDto } from './dto/list-stock-ins-query.dto';
import { UpdateStockInItemDto } from './dto/update-stock-in-item.dto';
import { UpdateStockInDto } from './dto/update-stock-in.dto';
import { StockInsService } from './stock-ins.service';

@ApiTags('stock-ins')
@ApiBearerAuth()
@Controller('stock-ins')
export class StockInsController {
  constructor(private readonly stockInsService: StockInsService) {}

  @Get()
  @RequirePermissions('stock-ins.view')
  @ApiOperation({
    summary: 'Lists stock-ins (paginated, filter by warehouseId/status/search)',
  })
  findAll(@Query() query: ListStockInsQueryDto) {
    return this.stockInsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('stock-ins.view')
  @ApiOperation({ summary: 'Gets a stock-in' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stockInsService.findOne(id);
  }

  @Post()
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Creates a draft stock-in' })
  create(@Body() dto: CreateStockInDto, @CurrentUser() user: User) {
    return this.stockInsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({
    summary: 'Updates a draft stock-in (warehouseId is immutable)',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStockInDto) {
    return this.stockInsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Deletes a draft stock-in' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.stockInsService.remove(id);
  }

  @Get(':id/items')
  @RequirePermissions('stock-ins.view')
  @ApiOperation({ summary: "Lists a stock-in's items" })
  listItems(@Param('id', ParseIntPipe) id: number) {
    return this.stockInsService.listItems(id);
  }

  @Post(':id/items')
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Adds an item to a draft stock-in' })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStockInItemDto,
  ) {
    return this.stockInsService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Updates an item on a draft stock-in' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateStockInItemDto,
  ) {
    return this.stockInsService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Removes an item from a draft stock-in' })
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.stockInsService.removeItem(id, itemId);
  }

  @Post(':id/approve')
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({
    summary:
      'Approves a draft stock-in: posts an opening_stock ledger entry per item and updates warehouse stock',
  })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.stockInsService.approve(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('stock-ins.manage')
  @ApiOperation({ summary: 'Cancels a draft stock-in (no ledger effect)' })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.stockInsService.cancel(id);
  }
}
