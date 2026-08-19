import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { BootstrapService } from './bootstrap.service';
import { PosBootstrapQueryDto } from './dto/pos-bootstrap-query.dto';
import { ReservationsBootstrapQueryDto } from './dto/reservations-bootstrap-query.dto';
import { WaiterPosBootstrapResponseDto } from './dto/waiter-pos-bootstrap-response.dto';

@ApiTags('bootstrap')
@ApiBearerAuth()
@Controller()
export class BootstrapController {
  constructor(
    private readonly bootstrapService: BootstrapService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get('pos/bootstrap')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      'One-call waiter POS screen bootstrap: outlet, departments, tables, food categories, addons — minimal fields only, scoped to an outlet the caller is actually assigned to',
  })
  @ApiOkResponse({ type: WaiterPosBootstrapResponseDto })
  async getPosBootstrap(
    @Query() query: PosBootstrapQueryDto,
    @CurrentUser() user: User,
  ): Promise<WaiterPosBootstrapResponseDto> {
    // The client picks which of the caller's own outlets to bootstrap (e.g.
    // switching outlets via the picker), but the requested id is never
    // trusted on its own — it's checked against the caller's real
    // assignments (or superadmin) before anything is fetched, same pattern
    // as OrdersController#assertOrderAccess.
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      query.outletId,
    );
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
