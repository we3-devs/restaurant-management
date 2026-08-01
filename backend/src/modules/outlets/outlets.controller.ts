import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsService } from '../auth/permissions.service';
import { User } from '../users/entities/user.entity';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { ListOutletsQueryDto } from './dto/list-outlets-query.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { OutletsService } from './outlets.service';

@ApiTags('outlets')
@ApiBearerAuth()
@Controller('outlets')
export class OutletsController {
  constructor(
    private readonly outletsService: OutletsService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('outlets.view')
  @ApiOperation({ summary: 'Lists outlets (paginated, optional search)' })
  findAll(@Query() query: ListOutletsQueryDto) {
    return this.outletsService.findAll(query);
  }

  /**
   * Outlets the current user is actually assigned to — no `outlets.view`
   * permission required, since knowing which outlet(s) you work at is an
   * assignment fact, not a permission grant. Superadmins and users with only
   * global (unscoped) assignments get every outlet back, same as before;
   * everyone else gets exactly their assigned outlets, never the full list.
   * Must stay declared before `:id` so "assigned" isn't parsed as an id.
   */
  @Get('assigned')
  @ApiOperation({
    summary:
      "Lists only the current user's assigned outlets (falls back to every outlet for superadmins / globally-scoped users)",
  })
  async findAssigned(@CurrentUser() user: User) {
    const outletIds = user.isSuperadmin
      ? []
      : await this.permissionsService.getAccessibleOutletIds(user.id);

    if (user.isSuperadmin || outletIds.length === 0) {
      return this.outletsService.findAllUnpaginated();
    }
    return this.outletsService.findByIds(outletIds);
  }

  @Get(':id')
  @RequirePermissions('outlets.view')
  @ApiOperation({ summary: 'Gets an outlet' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.outletsService.findOne(id);
  }

  @Post()
  @RequirePermissions('outlets.manage')
  @ApiOperation({ summary: 'Creates an outlet' })
  create(@Body() dto: CreateOutletDto) {
    return this.outletsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('outlets.manage')
  @ApiOperation({ summary: 'Updates an outlet' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOutletDto) {
    return this.outletsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('outlets.manage')
  @ApiOperation({
    summary:
      'Deletes an outlet (409 if departments/warehouses/orders/etc. still reference it)',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.outletsService.remove(id);
  }
}
