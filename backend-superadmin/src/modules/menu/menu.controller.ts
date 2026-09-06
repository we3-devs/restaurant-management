import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { MenuService } from './menu.service';

@ApiTags('menu')
@ApiBearerAuth()
@Controller('menu')
@RequirePermissions('orders.manage')
export class MenuController {
  constructor(private readonly menuService: MenuService, private readonly outletAccess: OutletAccessService) {}

  @Get('version')
  @ApiOperation({ summary: 'Get the current menu version' })
  async version(@Query('outletId') outletId: number, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, outletId);
    return this.menuService.getVersion();
  }

  @Get('bootstrap')
  @ApiOperation({ summary: 'Download the POS menu catalog' })
  async bootstrap(@Query('outletId') outletId: number, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, outletId);
    return this.menuService.getBootstrap(outletId);
  }
}
