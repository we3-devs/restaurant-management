import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { CreateGoodsReceivingDto } from './dto/create-goods-receiving.dto';
import { ListGoodsReceivingQueryDto } from './dto/list-goods-receiving-query.dto';
import { GoodsReceivingService } from './goods-receiving.service';

@ApiTags('goods-receiving')
@ApiBearerAuth()
@Controller('goods-receiving')
export class GoodsReceivingController {
  constructor(
    private readonly grnService: GoodsReceivingService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  /** Resolves the GRN and asserts outlet access — same choke-point pattern as OrdersController#assertOrderAccess. */
  private async assertGrnAccess(id: number, user: User) {
    const grn = await this.grnService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, grn.outletId);
    return grn;
  }

  @Get() @RequirePermissions('goods-receiving.view')
  @ApiOperation({ summary: 'Lists goods receiving (paginated, filterable)' })
  async findAll(@Query() query: ListGoodsReceivingQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, query.outletId);
    }
    return this.grnService.findAll(query, accessible);
  }

  @Get(':id') @RequirePermissions('goods-receiving.view')
  @ApiOperation({ summary: 'Gets a goods receiving record' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertGrnAccess(id, user);
  }

  @Post() @RequirePermissions('goods-receiving.manage')
  @ApiOperation({ summary: 'Creates a goods receiving (updates inventory, PO status)' })
  async create(@Body() dto: CreateGoodsReceivingDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.grnService.create(dto, user.id);
  }

  @Post(':id/cancel') @HttpCode(HttpStatus.OK) @RequirePermissions('goods-receiving.manage')
  @ApiOperation({ summary: 'Cancels a draft goods receiving' })
  async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertGrnAccess(id, user);
    return this.grnService.cancel(id);
  }

  @Get(':id/items') @RequirePermissions('goods-receiving.view')
  @ApiOperation({ summary: "Lists a goods receiving's items" })
  async listItems(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertGrnAccess(id, user);
    return this.grnService.listItems(id);
  }
}
