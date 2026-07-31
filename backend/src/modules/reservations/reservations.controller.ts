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
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @RequirePermissions('reservations.view')
  @ApiOperation({
    summary:
      'Lists reservations (paginated, optional outletId/customerId/status/source filters)',
  })
  findAll(@Query() query: ListReservationsQueryDto) {
    return this.reservationsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('reservations.view')
  @ApiOperation({ summary: 'Gets a reservation' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.findOne(id);
  }

  @Post()
  @RequirePermissions('reservations.manage')
  @ApiOperation({ summary: 'Creates a reservation' })
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: User) {
    return this.reservationsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('reservations.manage')
  @ApiOperation({
    summary: 'Updates a reservation (outletId/customerId are immutable)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('reservations.manage')
  @ApiOperation({
    summary:
      'Transitions a reservation status; seating auto-starts a table session on its first assigned table',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.reservationsService.updateStatus(id, dto, user.id);
  }

  @Get(':id/tables')
  @RequirePermissions('reservations.view')
  @ApiOperation({ summary: "Lists a reservation's assigned dining tables" })
  listTables(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.listTables(id);
  }

  @Post(':id/tables')
  @RequirePermissions('reservations.manage')
  @ApiOperation({ summary: 'Assigns a dining table to a reservation' })
  assignTable(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignReservationTableDto,
  ) {
    return this.reservationsService.assignTable(id, dto);
  }

  @Delete(':id/tables/:diningTableId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('reservations.manage')
  @ApiOperation({ summary: 'Unassigns a dining table from a reservation' })
  unassignTable(
    @Param('id', ParseIntPipe) id: number,
    @Param('diningTableId', ParseIntPipe) diningTableId: number,
  ) {
    return this.reservationsService.unassignTable(id, diningTableId);
  }
}
