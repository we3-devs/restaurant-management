import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { CreateTableSessionDto } from './dto/create-table-session.dto';
import { ListTableSessionsQueryDto } from './dto/list-table-sessions-query.dto';
import { SetTableSessionCustomerDto } from './dto/set-table-session-customer.dto';
import { TransferTableSessionDto } from './dto/transfer-table-session.dto';
import { TableSessionsService } from './table-sessions.service';

@ApiTags('table-sessions')
@ApiBearerAuth()
@Controller('table-sessions')
export class TableSessionsController {
  constructor(
    private readonly tableSessionsService: TableSessionsService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  /** Resolves the session and asserts outlet access — same choke-point pattern as OrdersController#assertOrderAccess. */
  private async assertSessionAccess(id: number, user: User) {
    const session = await this.tableSessionsService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      session.outletId,
    );
    return session;
  }

  @Get()
  @RequirePermissions('table-sessions.view')
  @ApiOperation({
    summary:
      'Lists table sessions (paginated, optional outletId/diningTableId/status filters)',
  })
  async findAll(
    @Query() query: ListTableSessionsQueryDto,
    @CurrentUser() user: User,
  ) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(
      user.id,
      user.isSuperadmin,
    );
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(
        user.id,
        user.isSuperadmin,
        query.outletId,
      );
    }
    return this.tableSessionsService.findAll(query, accessible);
  }

  @Get(':id')
  @RequirePermissions('table-sessions.view')
  @ApiOperation({
    summary: 'Gets a table session, with outlet/table names and guest (customer) detail resolved',
  })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertSessionAccess(id, user);
    return this.tableSessionsService.findOneDetailed(id);
  }

  @Post()
  @RequirePermissions('table-sessions.manage')
  @ApiOperation({
    summary: 'Starts a table session (flips the table status to occupied)',
  })
  async create(@Body() dto: CreateTableSessionDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      dto.outletId,
    );
    return this.tableSessionsService.create(dto, user.id);
  }

  @Post(':id/end')
  @RequirePermissions('table-sessions.manage')
  @ApiOperation({
    summary: 'Ends a table session (flips the table status back to available)',
  })
  async end(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertSessionAccess(id, user);
    return this.tableSessionsService.end(id, user.id);
  }

  @Post(':id/transfer')
  @RequirePermissions('table-sessions.manage')
  @ApiOperation({
    summary:
      'Moves an in-progress session to a different table (same outlet, destination must be free)',
  })
  async transfer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransferTableSessionDto,
    @CurrentUser() user: User,
  ) {
    await this.assertSessionAccess(id, user);
    return this.tableSessionsService.transfer(id, dto, user.id);
  }

  @Post(':id/customer')
  @RequirePermissions('table-sessions.manage')
  @ApiOperation({
    summary: "Sets or changes the table session's customer of record",
  })
  async setCustomer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetTableSessionCustomerDto,
    @CurrentUser() user: User,
  ) {
    await this.assertSessionAccess(id, user);
    return this.tableSessionsService.setCustomer(id, dto.customerId);
  }
}
