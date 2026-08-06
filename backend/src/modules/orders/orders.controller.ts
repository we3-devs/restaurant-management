import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentCustomer } from '../customer-auth/decorators/current-customer.decorator';
import { CustomerJwtAuthGuard } from '../customer-auth/guards/customer-jwt-auth.guard';
import { requireVerifiedCustomerId } from '../customer-auth/require-verified-customer.util';
import type { CustomerJwtPayload } from '../customer-auth/types/customer-jwt-payload';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { KitchenTicketsService } from '../kitchen-tickets/kitchen-tickets.service';
import { TableSessionsService } from '../table-sessions/table-sessions.service';
import { User } from '../users/entities/user.entity';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { CreateOrderItemsBatchDto } from './dto/create-order-item-batch.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { RedeemLoyaltyPointsDto } from './dto/redeem-loyalty-points.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import type { OrderStatus } from './entities/order.entity';
import { OrdersService } from './orders.service';

/** A guest may only back out before the kitchen has made real progress on their order. */
const GUEST_CANCELLABLE_STATUSES: OrderStatus[] = ['pending', 'accepted'];

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly kitchenTicketsService: KitchenTicketsService,
    private readonly diningTablesService: DiningTablesService,
    private readonly tableSessionsService: TableSessionsService,
  ) {}

  @Public()
  @UseGuards(CustomerJwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('guest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Guest self-ordering from /guest — requires an OTP-verified customer session. Opens a table session (source: qr_order) if the table has none yet.',
  })
  async createGuestOrder(
    @Body() dto: CreateGuestOrderDto,
    @CurrentCustomer() customer: CustomerJwtPayload,
  ) {
    const customerId = requireVerifiedCustomerId(customer, 'to order');
    const table = await this.diningTablesService.findByCode(dto.tableCode);

    const session = await this.tableSessionsService.ensureActiveForGuest(
      table.id,
      table.outletId,
      customerId,
    );

    return this.ordersService.createFromGuest(
      table.outletId,
      session.id,
      customerId,
      dto.items,
      table.id,
      table.name,
    );
  }

  @Public()
  @UseGuards(CustomerJwtAuthGuard)
  @Post('guest/:id/cancel')
  @ApiOperation({
    summary:
      "Lets a verified guest cancel the table's shared order — only while it's 'pending' or 'accepted' (before the kitchen has made real progress).",
  })
  async cancelGuestOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentCustomer() customer: CustomerJwtPayload,
  ) {
    // Ownership isn't checked against a single customerId here — the order
    // is a shared cart for the whole table (see OrdersService.createFromGuest),
    // so any phone-verified guest at the table can cancel it. The real guard
    // is the status check below: nobody can cancel once the kitchen has
    // made real progress.
    requireVerifiedCustomerId(customer, 'to order');
    const order = await this.ordersService.findOne(id);
    if (!GUEST_CANCELLABLE_STATUSES.includes(order.status)) {
      throw new ConflictException(
        `Order ${id} can no longer be cancelled (status: ${order.status})`,
      );
    }
    return this.ordersService.updateStatus(id, { status: 'cancelled' }, null);
  }

  @Public()
  @UseGuards(CustomerJwtAuthGuard)
  @Get('guest/mine')
  @ApiOperation({
    summary:
      "The table's shared order(s) (with items) on this table's current visit, most recent first — for /guest order tracking.",
  })
  async myGuestOrders(
    @Query('tableCode') tableCode: string,
    @CurrentCustomer() customer: CustomerJwtPayload,
  ) {
    requireVerifiedCustomerId(customer, 'to order');
    const table = await this.diningTablesService.findByCode(tableCode);
    // Scoped to this table's latest session, not just the outlet — a phone
    // number's orders from a previous, unrelated visit must never surface
    // (or be cancellable) from today's table session. See findMineForCustomer.
    const session = await this.tableSessionsService.findLatestForTable(table.id);
    if (!session) return [];
    return this.ordersService.findMineForCustomer(session.id);
  }

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

  @Get(':id/status-history')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: "Every recorded status transition for an order, oldest first" })
  listStatusHistory(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.listStatusHistory(id);
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
      'Transitions order status (rejects invalid transitions; auto-logs order_status_histories; completing the last active order on a table auto-ends its session and frees the table)',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.updateStatus(id, dto, user.id);
  }

  @Post('table-sessions/:id/complete-all')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      "Completes every open order on a table session at once, once every one of them is fully paid — the other half of 'pay for the whole table at once' (see POST /table-sessions/:id/payments)",
  })
  completeAllForTableSession(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.completeAllForTableSession(id, user.id);
  }

  @Post(':id/send-to-kitchen')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      "Moves every non-held 'stock_reserved' item to 'sent_to_kitchen' and creates a KitchenTicket per department represented (held items stay in the cart)",
  })
  sendToKitchen(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.sendToKitchen(id, user.id);
  }

  @Post(':id/mark-ready-items-served')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      "Waitstaff 'Mark Delivered': bulk-moves every 'ready' item across all of the order's kitchen tickets to 'served'",
  })
  markReadyItemsServed(@Param('id', ParseIntPipe) id: number) {
    return this.kitchenTicketsService.markOrderReadyItemsServed(id);
  }

  @Post(':id/fire-held-items')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      "'Fire Held Items': routes every held 'stock_reserved' item to the kitchen (un-holding as it goes)",
  })
  fireHeldItems(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.fireHeldItems(id, user.id);
  }

  @Post(':id/loyalty/redeem')
  @RequirePermissions('orders.manage')
  @ApiOperation({ summary: 'Redeems loyalty points against an order (recalculates totals)' })
  redeemLoyaltyPoints(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RedeemLoyaltyPointsDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.redeemLoyaltyPoints(id, dto.points, user.id);
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

  @Post(':id/items/batch')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      'Adds multiple items (each with optional addons) in one request — used by the POS to push a locally-built cart in one round-trip',
  })
  addItemsBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrderItemsBatchDto,
  ) {
    return this.ordersService.addItemsBatch(id, dto.items);
  }

}
