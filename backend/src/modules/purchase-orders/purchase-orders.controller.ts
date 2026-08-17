import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { AddPurchaseOrderItemDto, CreatePurchaseOrderDto, UpdatePurchaseOrderDto, UpdatePurchaseOrderItemDto } from './dto/create-purchase-order.dto';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders-query.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly poService: PurchaseOrdersService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  /** Resolves the PO and asserts outlet access — same choke-point pattern as OrdersController#assertOrderAccess. */
  private async assertPoAccess(id: number, user: User) {
    const po = await this.poService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, po.outletId);
    return po;
  }

  @Get() @RequirePermissions('purchase-orders.view')
  @ApiOperation({ summary: 'Lists purchase orders (paginated, filterable)' })
  async findAll(@Query() query: ListPurchaseOrdersQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, query.outletId);
    }
    return this.poService.findAll(query, accessible);
  }

  @Get(':id') @RequirePermissions('purchase-orders.view')
  @ApiOperation({ summary: 'Gets a purchase order' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertPoAccess(id, user);
  }

  @Post() @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Creates a draft purchase order' })
  async create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.poService.create(dto, user.id);
  }

  @Patch(':id') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Updates a draft purchase order' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePurchaseOrderDto, @CurrentUser() user: User) {
    await this.assertPoAccess(id, user);
    return this.poService.update(id, dto);
  }

  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Deletes a draft purchase order' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertPoAccess(id, user);
    return this.poService.remove(id);
  }

  @Get(':id/items') @RequirePermissions('purchase-orders.view')
  @ApiOperation({ summary: "Lists a purchase order's items" })
  async listItems(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertPoAccess(id, user);
    return this.poService.listItems(id);
  }

  @Post(':id/items') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Adds an item to a draft purchase order' })
  async addItem(@Param('id', ParseIntPipe) id: number, @Body() dto: AddPurchaseOrderItemDto, @CurrentUser() user: User) {
    await this.assertPoAccess(id, user);
    return this.poService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Updates an item on a draft purchase order' })
  async updateItem(@Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number, @Body() dto: UpdatePurchaseOrderItemDto, @CurrentUser() user: User) {
    await this.assertPoAccess(id, user);
    return this.poService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Removes an item from a draft purchase order' })
  async removeItem(@Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number, @CurrentUser() user: User) {
    await this.assertPoAccess(id, user);
    return this.poService.removeItem(id, itemId);
  }

  @Post(':id/submit') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Submits a draft PO for approval' })
  async submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertPoAccess(id, user);
    return this.poService.submitForApproval(id);
  }

  @Post(':id/approve') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Approves a pending purchase order (notifications sent)' })
  async approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertPoAccess(id, user);
    return this.poService.approve(id, user.id);
  }

  @Post(':id/reject') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Rejects a pending purchase order' })
  async reject(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertPoAccess(id, user);
    return this.poService.reject(id);
  }

  @Post(':id/cancel') @RequirePermissions('purchase-orders.manage')
  @ApiOperation({ summary: 'Cancels an order (from any non-completed status)' })
  async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertPoAccess(id, user);
    return this.poService.cancel(id);
  }
}
