import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { ListSupplierPaymentsQueryDto } from './dto/list-supplier-payments-query.dto';
import { SupplierPaymentsService } from './supplier-payments.service';

@ApiTags('supplier-payments')
@ApiBearerAuth()
@Controller('supplier-payments')
export class SupplierPaymentsController {
  constructor(
    private readonly spService: SupplierPaymentsService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  /** Resolves the payment and asserts outlet access — same choke-point pattern as OrdersController#assertOrderAccess. */
  private async assertPaymentAccess(id: number, user: User) {
    const payment = await this.spService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, payment.outletId);
    return payment;
  }

  @Get() @RequirePermissions('supplier-payments.view')
  @ApiOperation({ summary: 'Lists supplier payments (paginated, filterable)' })
  async findAll(@Query() query: ListSupplierPaymentsQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, query.outletId);
    }
    return this.spService.findAll(query, accessible);
  }

  @Get(':id') @RequirePermissions('supplier-payments.view')
  @ApiOperation({ summary: 'Gets a supplier payment' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertPaymentAccess(id, user);
  }

  @Post() @RequirePermissions('supplier-payments.manage')
  @ApiOperation({ summary: 'Records a supplier payment' })
  async create(@Body() dto: CreateSupplierPaymentDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.spService.create(dto, user.id);
  }

  @Post(':id/cancel') @HttpCode(HttpStatus.OK) @RequirePermissions('supplier-payments.manage')
  @ApiOperation({ summary: 'Cancels a supplier payment' })
  async cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertPaymentAccess(id, user);
    return this.spService.cancel(id);
  }
}
