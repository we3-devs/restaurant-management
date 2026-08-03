import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { KdsBootstrapQueryDto } from './dto/kds-bootstrap-query.dto';
import { ListKitchenTicketsQueryDto } from './dto/list-kitchen-tickets-query.dto';
import { UpdateKitchenTicketItemStatusDto } from './dto/update-kitchen-ticket-item-status.dto';
import { UpdateKitchenTicketPriorityDto } from './dto/update-kitchen-ticket-priority.dto';
import { KitchenTicketsService } from './kitchen-tickets.service';

// Reads share orders.view with OrdersController (kitchen tickets are a
// projection of orders, created solely as a side effect of
// OrdersService.sendToKitchen()). Mutations require kitchen-tickets.manage
// instead of orders.manage — that slug is for taking/editing orders at the
// POS (waiters need it) and is deliberately separate from running the KDS
// board (cooks need it), so a waiter with POS access doesn't also get
// start/prepare/serve/cancel/recall buttons on the kitchen screen.
@ApiTags('kitchen-tickets')
@ApiBearerAuth()
@Controller('kitchen-tickets')
export class KitchenTicketsController {
  constructor(private readonly kitchenTicketsService: KitchenTicketsService) {}

  @Get('bootstrap')
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary:
      'One-call KDS screen bootstrap: stations + open/in-progress tickets (with items) for an outlet',
  })
  getBootstrap(@Query() query: KdsBootstrapQueryDto) {
    return this.kitchenTicketsService.getKdsBootstrap(query.outletId);
  }

  @Get()
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary:
      'Lists kitchen tickets (paginated, optional outletId/orderId/departmentId/status filters)',
  })
  findAll(@Query() query: ListKitchenTicketsQueryDto) {
    return this.kitchenTicketsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Gets a kitchen ticket' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.kitchenTicketsService.findOne(id);
  }

  @Get(':id/items')
  @RequirePermissions('orders.view')
  @ApiOperation({ summary: 'Lists the order items on a kitchen ticket' })
  listItems(@Param('id', ParseIntPipe) id: number) {
    return this.kitchenTicketsService.listItems(id);
  }

  @Patch(':id/items/:itemId/status')
  @RequirePermissions('kitchen-tickets.manage')
  @ApiOperation({
    summary:
      'Advances a kitchen ticket item through sent_to_kitchen -> preparing -> ready -> served (or -> cancelled)',
  })
  updateItemStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateKitchenTicketItemStatusDto,
  ) {
    return this.kitchenTicketsService.updateItemStatus(id, itemId, dto.status);
  }

  @Patch(':id/priority')
  @RequirePermissions('kitchen-tickets.manage')
  @ApiOperation({ summary: "Sets a kitchen ticket's priority" })
  updatePriority(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKitchenTicketPriorityDto,
  ) {
    return this.kitchenTicketsService.updatePriority(id, dto.priority);
  }

  @Post(':id/start')
  @RequirePermissions('kitchen-tickets.manage')
  @ApiOperation({
    summary:
      "Ticket-level 'Start': bulk-moves every sent_to_kitchen item to preparing",
  })
  startTicket(@Param('id', ParseIntPipe) id: number) {
    return this.kitchenTicketsService.startTicket(id);
  }

  @Post(':id/mark-ready')
  @RequirePermissions('kitchen-tickets.manage')
  @ApiOperation({
    summary:
      "Ticket-level 'Mark Ready': bulk-moves every sent/preparing item to ready",
  })
  markTicketReady(@Param('id', ParseIntPipe) id: number) {
    return this.kitchenTicketsService.markTicketReady(id);
  }

  @Post(':id/mark-served')
  @RequirePermissions('kitchen-tickets.manage')
  @ApiOperation({
    summary:
      "Ticket-level 'Mark Served': bulk-moves every ready item to served",
  })
  markTicketServed(@Param('id', ParseIntPipe) id: number) {
    return this.kitchenTicketsService.markTicketServed(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('kitchen-tickets.manage')
  @ApiOperation({ summary: 'Cancels a kitchen ticket and its open items' })
  cancelTicket(@Param('id', ParseIntPipe) id: number) {
    return this.kitchenTicketsService.cancelTicket(id);
  }

  @Post(':id/items/:itemId/recall')
  @RequirePermissions('kitchen-tickets.manage')
  @ApiOperation({
    summary: 'Reopens a "ready"/"served" item back to "preparing"',
  })
  recallItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.kitchenTicketsService.recallItem(id, itemId);
  }
}
