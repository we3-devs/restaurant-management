import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { BootstrapService } from './bootstrap.service';
import { PosBootstrapQueryDto } from './dto/pos-bootstrap-query.dto';
import { ReservationsBootstrapQueryDto } from './dto/reservations-bootstrap-query.dto';

@ApiTags('bootstrap')
@ApiBearerAuth()
@Controller()
export class BootstrapController {
  constructor(private readonly bootstrapService: BootstrapService) {}

  @Get('pos/bootstrap')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      'One-call POS screen bootstrap: outlet, departments, tables, food categories, addons',
  })
  getPosBootstrap(@Query() query: PosBootstrapQueryDto) {
    return this.bootstrapService.getPosBootstrap(query);
  }

  @Get('reservations/bootstrap')
  @RequirePermissions('reservations.view')
  @ApiOperation({
    summary:
      'One-call reservations screen bootstrap: reservations, customers, outlets',
  })
  getReservationsBootstrap(@Query() query: ReservationsBootstrapQueryDto) {
    return this.bootstrapService.getReservationsBootstrap(query);
  }

  @Get('inventory/bootstrap')
  @RequirePermissions('ingredients.view')
  @ApiOperation({
    summary:
      'One-call inventory screen bootstrap: ingredients, units, categories, warehouses',
  })
  getInventoryBootstrap() {
    return this.bootstrapService.getInventoryBootstrap();
  }
}
