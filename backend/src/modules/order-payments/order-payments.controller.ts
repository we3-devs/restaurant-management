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
import { User } from '../users/entities/user.entity';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { CreateTableSessionPaymentDto } from './dto/create-table-session-payment.dto';
import { ListOrderPaymentsQueryDto } from './dto/list-order-payments-query.dto';
import { OrderPaymentsService } from './order-payments.service';

@ApiTags('order-payments')
@ApiBearerAuth()
@Controller()
export class OrderPaymentsController {
  constructor(private readonly orderPaymentsService: OrderPaymentsService) {}

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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orderPaymentsService.findOne(id);
  }

  @Post('orders/:id/payments')
  @RequirePermissions('order-payments.manage')
  @ApiOperation({
    summary:
      'Records a payment or refund against an order (immutable ledger row; recalculates paidAmount/dueAmount/paymentStatus)',
  })
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrderPaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.orderPaymentsService.create(id, dto, user.id);
  }

  @Post('table-sessions/:id/payments')
  @RequirePermissions('order-payments.manage')
  @ApiOperation({
    summary:
      "Records one combined payment across a table session's open orders (oldest order's balance first) — 'pay for the whole table at once' instead of paying off each order separately",
  })
  createForTableSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTableSessionPaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.orderPaymentsService.payForTableSession(id, dto, user.id);
  }
}
