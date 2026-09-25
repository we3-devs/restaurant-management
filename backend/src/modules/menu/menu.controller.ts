import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { User } from '../users/entities/user.entity';
import { MenuService } from './menu.service';

@ApiTags('menu')
@ApiBearerAuth()
@Controller('menu')
@RequirePermissions('orders.manage')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly outletAccess: OutletAccessService,
    private readonly diningTables: DiningTablesService,
  ) {}

  @Get('version')
  @ApiOperation({ summary: 'Get the current menu version' })
  async version(
    @Query('outletId') outletId: number,
    @CurrentUser() user: User,
  ) {
    await this.outletAccess.assertOutletAccess(user.id, outletId);
    return this.menuService.getVersion();
  }

  @Get('bootstrap')
  @ApiOperation({ summary: 'Download the POS menu catalog' })
  async bootstrap(
    @Query('outletId') outletId: number,
    @CurrentUser() user: User,
  ) {
    await this.outletAccess.assertOutletAccess(user.id, outletId);
    return this.menuService.getBootstrap(outletId);
  }

  /**
   * Guest-web's menu — same catalog, same food items, same live stock
   * availability as POS's own `bootstrap` above, just reached by tableCode
   * instead of an authenticated outletId. Previously guest ordering read
   * from FoodsService#findPublicMenu, a separate hand-trimmed projection
   * that never got the FoodVariant-level inventoryAvailable/addon data POS
   * has, so the two menus silently drifted apart. Resolving outletId from
   * the table server-side (never trusting a client-supplied outletId) keeps
   * a guest scoped to their own table's outlet.
   *
   * @Public() bypasses JwtAuthGuard/PermissionsGuard the same way the guest
   * table-scan endpoint does; RequirePermissions() with no args clears the
   * class-level 'orders.manage' requirement that would otherwise still
   * apply (PermissionsGuard reads method metadata first, falling back to
   * the class only when the method sets none).
   */
  @Public()
  @RequirePermissions()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('guest-bootstrap')
  @ApiOperation({
    summary: 'Download the guest-ordering menu catalog for a table (same data as POS bootstrap, scoped by tableCode)',
  })
  async guestBootstrap(@Query('tableCode') tableCode: string) {
    if (!tableCode || typeof tableCode !== 'string') {
      throw new BadRequestException('tableCode is required');
    }
    const table = await this.diningTables.findByCode(tableCode);
    return this.menuService.getBootstrap(table.outletId);
  }
}
