import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { OrdersService } from '../orders/orders.service';
import { TableSessionsService } from '../table-sessions/table-sessions.service';
import { User } from '../users/entities/user.entity';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { CreateTableSessionPaymentDto } from './dto/create-table-session-payment.dto';
import { ListOrderPaymentsQueryDto } from './dto/list-order-payments-query.dto';
import { OrderPaymentsService } from './order-payments.service';

@ApiTags('order-payments')
@ApiBearerAuth()
@Controller()
export class OrderPaymentsController {
  constructor(
    private readonly orderPaymentsService: OrderPaymentsService,
    private readonly ordersService: OrdersService,
    private readonly tableSessionsService: TableSessionsService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get('order-payments')
  @RequirePermissions('order-payments.view')
  @ApiOperation({
    summary: 'Lists order payments (paginated, optional orderId filter)',
  })
  findAll(@Query() query: ListOrderPaymentsQueryDto) {
    return this.orderPaymentsService.findAll(query);
  }

  @Get('order-payments/:id')
  @RequirePermissions('order-payments.view')
  @ApiOperation({ summary: 'Gets an order payment' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const payment = await this.orderPaymentsService.findOne(id);
    const order = await this.ordersService.findOne(payment.orderId);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      order.outletId,
    );
    return payment;
  }

  @Post('orders/:id/payments')
  @RequirePermissions('order-payments.manage')
  @ApiOperation({
    summary:
      'Records a payment or refund against an order (immutable ledger row; recalculates paidAmount/dueAmount/paymentStatus)',
  })
  async create(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrderPaymentDto,
    @CurrentUser() user: User,
  ) {
    const order = await this.ordersService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      order.outletId,
    );
    return this.orderPaymentsService.create(id, dto, user.id);
  }

  @Post('table-sessions/:id/payments')
  @RequirePermissions('order-payments.manage')
  @ApiOperation({
    summary:
      "Records one combined payment across a table session's open orders (oldest order's balance first) — 'pay for the whole table at once' instead of paying off each order separately",
  })
  async createForTableSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTableSessionPaymentDto,
    @CurrentUser() user: User,
  ) {
    const session = await this.tableSessionsService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      session.outletId,
    );
    return this.orderPaymentsService.payForTableSession(id, dto, user.id);
  }
}
