import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { AddPurchaseOrderItemDto, CreatePurchaseOrderDto, UpdatePurchaseOrderDto, UpdatePurchaseOrderItemDto } from './dto/create-purchase-order.dto';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders-query.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly poService: PurchaseOrdersService) {}

  @Get() @RequirePermissions('purchase-orders.view')
  @ApiOperation({ summary: 'Lists purchase orders (paginated, filterable)' })
  findAll(@Query() query: ListPurchaseOrdersQueryDto) { return this.poService.findAll(query); }

  @Get(':id') @RequirePermissions('purchase-orders.view')
  @ApiOperation({ summary: 'Gets a purchase order' })
  findOne(@Param('id', ParseIntPipe) id: number) { return this.poService.findOne(id); }

  @Post() @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Creates a draft purchase order' })
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: User) { return this.poService.create(dto, user.id); }

  @Patch(':id') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Updates a draft purchase order' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePurchaseOrderDto) { return this.poService.update(id, dto); }

  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Deletes a draft purchase order' })
  remove(@Param('id', ParseIntPipe) id: number) { return this.poService.remove(id); }

  @Get(':id/items') @RequirePermissions('purchase-orders.view')
  @ApiOperation({ summary: "Lists a purchase order's items" })
  listItems(@Param('id', ParseIntPipe) id: number) { return this.poService.listItems(id); }

  @Post(':id/items') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Adds an item to a draft purchase order' })
  addItem(@Param('id', ParseIntPipe) id: number, @Body() dto: AddPurchaseOrderItemDto) { return this.poService.addItem(id, dto); }

  @Patch(':id/items/:itemId') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Updates an item on a draft purchase order' })
  updateItem(@Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number, @Body() dto: UpdatePurchaseOrderItemDto) {
    return this.poService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Removes an item from a draft purchase order' })
  removeItem(@Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number) { return this.poService.removeItem(id, itemId); }

  @Post(':id/submit') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Submits a draft PO for approval' })
  submit(@Param('id', ParseIntPipe) id: number) { return this.poService.submitForApproval(id); }

  @Post(':id/approve') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Approves a pending purchase order (notifications sent)' })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) { return this.poService.approve(id, user.id); }

  @Post(':id/reject') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Rejects a pending purchase order' })
  reject(@Param('id', ParseIntPipe) id: number) { return this.poService.reject(id); }

  @Post(':id/cancel') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Cancels an order (from any non-completed status)' })
  cancel(@Param('id', ParseIntPipe) id: number) { return this.poService.cancel(id); }
}
