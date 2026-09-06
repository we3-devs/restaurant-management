import { Controller, Get, Param, ParseIntPipe, Put, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { UpdateOperatingHoursDto } from './dto/update-operating-hours.dto';
import { OperatingHoursService } from './operating-hours.service';

@ApiTags('operating-hours') @ApiBearerAuth() @Controller('outlets/:outletId/operating-hours')
export class OperatingHoursController {
  constructor(private readonly service: OperatingHoursService, private readonly outletAccess: OutletAccessService) {}

  @Get() @RequirePermissions('settings.view')
  async get(@Param('outletId', ParseIntPipe) outletId: number, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, outletId);
    return this.service.getStatus(outletId);
  }

  @Put() @RequirePermissions('settings.manage')
  async update(@Param('outletId', ParseIntPipe) outletId: number, @Body() dto: UpdateOperatingHoursDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, outletId);
    return this.service.update(outletId, dto, user.id);
  }
}
