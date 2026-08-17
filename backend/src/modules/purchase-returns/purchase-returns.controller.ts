import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { ListPurchaseReturnsQueryDto } from './dto/list-purchase-returns-query.dto';
import { PurchaseReturnsService } from './purchase-returns.service';

@ApiTags('purchase-returns')
@ApiBearerAuth()
@Controller('purchase-returns')
export class PurchaseReturnsController {
  constructor(
    private readonly prService: PurchaseReturnsService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  /** Resolves the return and asserts outlet access — same choke-point pattern as OrdersController#assertOrderAccess. */
  private async assertReturnAccess(id: number, user: User) {
    const pr = await this.prService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, pr.outletId);
    return pr;
  }

  @Get() @RequirePermissions('purchase-returns.view')
  @ApiOperation({ summary: 'Lists purchase returns (paginated, filterable)' })
  async findAll(@Query() query: ListPurchaseReturnsQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, query.outletId);
    }
    return this.prService.findAll(query, accessible);
  }

  @Get(':id') @RequirePermissions('purchase-returns.view')
  @ApiOperation({ summary: 'Gets a purchase return' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertReturnAccess(id, user);
  }

  @Post() @RequirePermissions('purchase-returns.manage')
  @ApiOperation({ summary: 'Creates a draft purchase return' })
  async create(@Body() dto: CreatePurchaseReturnDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.prService.create(dto, user.id);
  }

  @Post(':id/process') @RequirePermissions('purchase-returns.manage')
  @ApiOperation({ summary: 'Processes a purchase return (updates inventory)' })
  async process(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertReturnAccess(id, user);
    return this.prService.process(id, user.id);
  }

  @Post(':id/cancel') @HttpCode(HttpStatus.OK) @RequirePermissions('purchase-returns.manage')
  @ApiOperation({ summary: 'Cancels a draft purchase return' })
  async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertReturnAccess(id, user);
    return this.prService.cancel(id);
  }

  @Get(':id/items') @RequirePermissions('purchase-returns.view')
  @ApiOperation({ summary: "Lists a purchase return's items" })
  async listItems(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertReturnAccess(id, user);
    return this.prService.listItems(id);
  }
}
