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
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateOrderItemAddonDto } from './dto/create-order-item-addon.dto';
import { ListOrderItemsQueryDto } from './dto/list-order-items-query.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { OrdersService } from './orders.service';

// Guarded by the same orders.view/orders.manage permissions as OrdersController
// — order items are a compositional part of an order, not an independent domain.
@ApiTags('orders')
@ApiBearerAuth()
@Controller('order-items')
export class OrderItemsController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary: 'Lists order items (paginated, optional orderId filter)',
  })
  findAll(@Query() query: ListOrderItemsQueryDto) {
    return this.ordersService.listItems(query);
  }

  @Get(':id')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Gets an order item' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findItem(id);
  }

  @Patch(':id')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      'Updates an order item (foodId/foodVariantId/orderId/preparationDepartmentId are immutable; recalculates totals)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderItemDto,
  ) {
    return this.ordersService.updateItem(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      'Removes an order item (no guard against removing one already sent to the kitchen)',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.removeItem(id);
  }

  @Get(':id/addons')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Lists addons on an order item' })
  listAddons(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.listItemAddons(id);
  }

  @Post(':id/addons')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary: 'Adds an addon to an order item, snapshotting its current price',
  })
  addAddon(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrderItemAddonDto,
  ) {
    return this.ordersService.addItemAddon(id, dto);
  }

  @Delete(':id/addons/:addonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('orders.manage')
  @ApiOperation({ summary: 'Removes an addon from an order item' })
  removeAddon(
    @Param('id', ParseIntPipe) id: number,
    @Param('addonId', ParseIntPipe) addonId: number,
  ) {
    return this.ordersService.removeItemAddon(id, addonId);
  }
}
