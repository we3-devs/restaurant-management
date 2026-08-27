import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { PermissionsService } from '../auth/permissions.service';
import { User } from '../users/entities/user.entity';
import { CreateOrderItemAddonDto } from './dto/create-order-item-addon.dto';
import { ListOrderItemsQueryDto } from './dto/list-order-items-query.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { VoidOrderItemDto } from './dto/void-order-item.dto';
import { OrdersService } from './orders.service';

// Guarded by the same orders.view/orders.manage permissions as OrdersController
// — order items are a compositional part of an order, not an independent domain.
@ApiTags('orders')
@ApiBearerAuth()
@Controller('order-items')
export class OrderItemsController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly outletAccess: OutletAccessService,
    private readonly permissionsService: PermissionsService,
  ) {}

  /** Resolves the item's parent order and asserts outlet access on it — same choke-point pattern as OrdersController#assertOrderAccess. */
  private async assertItemAccess(itemId: number, user: User) {
    const item = await this.ordersService.findItem(itemId);
    const order = await this.ordersService.findOne(item.orderId);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      order.outletId,
    );
    return item;
  }

  /**
   * Same choke point as assertItemAccess, but for the list endpoint: never
   * trust query.orderId on its own — resolve the order it names and check
   * the caller's outlet access before listing anything under it. Without
   * this, any orders.view holder could page through another outlet's order
   * items just by guessing/incrementing orderId (IDOR).
   */
  private async assertOrderAccess(orderId: number, user: User) {
    const order = await this.ordersService.findOne(orderId);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      order.outletId,
    );
    return order;
  }

  @Get()
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary:
      'Lists an order\'s items (paginated) — minimal, waiter-facing shape with food/variant names embedded so callers never need a follow-up request just to render a row.',
  })
  async findAll(
    @Query() query: ListOrderItemsQueryDto,
    @CurrentUser() user: User,
  ) {
    await this.assertOrderAccess(query.orderId, user);
    return this.ordersService.listItems(query);
  }

  @Get(':id')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Gets an order item' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertItemAccess(id, user);
  }

  @Patch(':id')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      'Updates an order item (foodId/foodVariantId/orderId/preparationDepartmentId are immutable; recalculates totals)',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertItemAccess(id, user);
    return this.ordersService.updateItem(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      "Removes an order item — only while it's still 'stock_reserved' (not yet sent to the kitchen). Once fired, use POST :id/void instead.",
  })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertItemAccess(id, user);
    // Hard-deleting a line item is destructive and unaudited compared to
    // void (which keeps the record and requires a reason) — same
    // manager-tier gate as cancelling an order. See OrdersController#updateStatus.
    if (!user.isSuperadmin) {
      const allowed = await this.permissionsService.hasPermission(
        user.id,
        'orders.delete',
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Deleting an order item requires the orders.delete permission',
        );
      }
    }
    return this.ordersService.removeItem(id);
  }

  @Post(':id/void')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      "Voids an item already sent to the kitchen (reason required) — marks it 'cancelled' and removes it from the bill instead of deleting its record.",
  })
  async voidItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidOrderItemDto,
    @CurrentUser() user: User,
  ) {
    await this.assertItemAccess(id, user);
    return this.ordersService.voidItem(id, dto.reason);
  }

  @Get(':id/addons')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Lists addons on an order item' })
  async listAddons(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertItemAccess(id, user);
    return this.ordersService.listItemAddons(id);
  }

  @Post(':id/addons')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary: 'Adds an addon to an order item, snapshotting its current price',
  })
  async addAddon(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrderItemAddonDto,
    @CurrentUser() user: User,
  ) {
    await this.assertItemAccess(id, user);
    return this.ordersService.addItemAddon(id, dto);
  }

  @Delete(':id/addons/:addonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('orders.manage')
  @ApiOperation({ summary: 'Removes an addon from an order item' })
  async removeAddon(
    @Param('id', ParseIntPipe) id: number,
    @Param('addonId', ParseIntPipe) addonId: number,
    @CurrentUser() user: User,
  ) {
    await this.assertItemAccess(id, user);
    return this.ordersService.removeItemAddon(id, addonId);
  }

  @Get(':id/reservations')
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary:
      "Lists an order item's ingredient reservations (reserved/consumed/released) — read-only, a side effect of item/addon add-remove and order completion/cancellation",
  })
  async listReservations(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertItemAccess(id, user);
    return this.ordersService.listItemReservations(id);
  }
}
