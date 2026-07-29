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
import { AssignOrderTableDto } from './dto/assign-order-table.dto';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary:
      'Lists orders (paginated, optional search on orderNumber + outletId/status filters)',
  })
  findAll(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Gets an order' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary: 'Creates an order (source/orderSource are hardcoded to staff/pos)',
  })
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: User) {
    return this.ordersService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      'Updates order note/discount/tax/service-charge (recalculates totals)',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      'Transitions order status (no transition-graph enforcement; auto-logs order_status_histories)',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.updateStatus(id, dto, user.id);
  }

  @Post(':id/items')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      'Adds an item to the order, snapshotting its current effective price at this outlet',
  })
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrderItemDto,
  ) {
    return this.ordersService.addItem(id, dto);
  }

  @Get(':id/tables')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Lists dining tables assigned to this order' })
  listTables(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.listTables(id);
  }

  @Post(':id/tables')
  @RequirePermissions('orders.manage')
  @ApiOperation({ summary: 'Assigns a dining table to the order (idempotent)' })
  assignTable(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignOrderTableDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.assignTable(id, dto, user.id);
  }

  @Delete(':id/tables/:diningTableId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('orders.manage')
  @ApiOperation({ summary: 'Unassigns a dining table from the order' })
  unassignTable(
    @Param('id', ParseIntPipe) id: number,
    @Param('diningTableId', ParseIntPipe) diningTableId: number,
  ) {
    return this.ordersService.unassignTable(id, diningTableId);
  }
}
