import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { ListSupplierPaymentsQueryDto } from './dto/list-supplier-payments-query.dto';
import { SupplierPaymentsService } from './supplier-payments.service';

@ApiTags('supplier-payments')
@ApiBearerAuth()
@Controller('supplier-payments')
export class SupplierPaymentsController {
  constructor(private readonly spService: SupplierPaymentsService) {}

  @Get() @RequirePermissions('supplier-payments.view')
  @ApiOperation({ summary: 'Lists supplier payments (paginated, filterable)' })
  findAll(@Query() query: ListSupplierPaymentsQueryDto) { return this.spService.findAll(query); }

  @Get(':id') @RequirePermissions('supplier-payments.view')
  @ApiOperation({ summary: 'Gets a supplier payment' })
  findOne(@Param('id', ParseIntPipe) id: number) { return this.spService.findOne(id); }

  @Post() @RequirePermissions('supplier-payments.manage')
  @ApiOperation({ summary: 'Records a supplier payment' })
  create(@Body() dto: CreateSupplierPaymentDto, @CurrentUser() user: User) { return this.spService.create(dto, user.id); }

  @Post(':id/cancel') @HttpCode(HttpStatus.OK) @RequirePermissions('supplier-payments.manage')
  @ApiOperation({ summary: 'Cancels a supplier payment' })
  cancel(@Param('id', ParseIntPipe) id: number) { return this.spService.cancel(id); }
}
