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
import { OutletAccessService } from '../auth/outlet-access.service';
import { User } from '../users/entities/user.entity';
import { AssignReservationTableDto } from './dto/assign-reservation-table.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  /** Resolves the reservation and asserts outlet access — same choke-point pattern as OrdersController#assertOrderAccess. */
  private async assertReservationAccess(id: number, user: User) {
    const reservation = await this.reservationsService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      reservation.outletId,
    );
    return reservation;
  }

  @Get()
  @RequirePermissions('reservations.view')
  @ApiOperation({
    summary:
      'Lists reservations (paginated, optional outletId/customerId/status/source filters)',
  })
  async findAll(
    @Query() query: ListReservationsQueryDto,
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
    return this.reservationsService.findAll(query, accessible);
  }

  @Get(':id')
  @RequirePermissions('reservations.view')
  @ApiOperation({ summary: 'Gets a reservation' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.assertReservationAccess(id, user);
  }

  @Post()
  @RequirePermissions('reservations.manage')
  @ApiOperation({ summary: 'Creates a reservation' })
  async create(@Body() dto: CreateReservationDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      dto.outletId,
    );
    return this.reservationsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('reservations.manage')
  @ApiOperation({
    summary: 'Updates a reservation (outletId/customerId are immutable)',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationDto,
    @CurrentUser() user: User,
  ) {
    await this.assertReservationAccess(id, user);
    return this.reservationsService.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('reservations.manage')
  @ApiOperation({
    summary:
      'Transitions a reservation status; seating auto-starts a table session on its first assigned table',
  })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationStatusDto,
    @CurrentUser() user: User,
  ) {
    await this.assertReservationAccess(id, user);
    return this.reservationsService.updateStatus(id, dto, user.id);
  }

  @Get(':id/tables')
  @RequirePermissions('reservations.view')
  @ApiOperation({ summary: "Lists a reservation's assigned dining tables" })
  async listTables(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    await this.assertReservationAccess(id, user);
    return this.reservationsService.listTables(id);
  }

  @Post(':id/tables')
  @RequirePermissions('reservations.manage')
  @ApiOperation({ summary: 'Assigns a dining table to a reservation' })
  async assignTable(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignReservationTableDto,
    @CurrentUser() user: User,
  ) {
    await this.assertReservationAccess(id, user);
    return this.reservationsService.assignTable(id, dto);
  }

  @Delete(':id/tables/:diningTableId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('reservations.manage')
  @ApiOperation({ summary: 'Unassigns a dining table from a reservation' })
  async unassignTable(
    @Param('id', ParseIntPipe) id: number,
    @Param('diningTableId', ParseIntPipe) diningTableId: number,
    @CurrentUser() user: User,
  ) {
    await this.assertReservationAccess(id, user);
    return this.reservationsService.unassignTable(id, diningTableId);
  }
}
