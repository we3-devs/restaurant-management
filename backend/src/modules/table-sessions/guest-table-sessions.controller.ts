import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { CustomersService } from '../customers/customers.service';
import { CurrentCustomer } from '../customer-auth/decorators/current-customer.decorator';
import { CustomerJwtAuthGuard } from '../customer-auth/guards/customer-jwt-auth.guard';
import { requireVerifiedCustomerId } from '../customer-auth/require-verified-customer.util';
import type { CustomerJwtPayload } from '../customer-auth/types/customer-jwt-payload';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { AddCompanionDto, JoinTableSessionDto } from './dto/guest-table-session.dto';
import { TableSessionsService } from './table-sessions.service';

@ApiTags('table-sessions')
@Public()
@UseGuards(CustomerJwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('table-sessions/guest')
export class GuestTableSessionsController {
  constructor(
    private readonly tableSessions: TableSessionsService,
    private readonly diningTables: DiningTablesService,
    private readonly customers: CustomersService,
  ) {}

  private async assertMember(sessionId: number, customerId: number) {
    const members = await this.tableSessions.listCustomers(sessionId);
    if (!members.some((m) => m.id === customerId)) {
      throw new ForbiddenException('Join this table before managing its party');
    }
  }

  @Post('join')
  @ApiOperation({
    summary:
      'Joins the verified guest to the table’s current session, opening one if the table has none yet. Every guest who scans the same table lands on the same session.',
  })
  async join(
    @Body() dto: JoinTableSessionDto,
    @CurrentCustomer() customer: CustomerJwtPayload,
  ) {
    const customerId = requireVerifiedCustomerId(customer, 'to join the table');
    const table = await this.diningTables.findByCode(dto.tableCode);
    const session = await this.tableSessions.ensureActiveForGuest(
      table.id,
      table.outletId,
      customerId,
    );
    return this.tableSessions.findOneDetailed(session.id);
  }

  @Get('current')
  @ApiOperation({ summary: 'The table’s current session and its party, or null.' })
  async current(
    @Query('tableCode') tableCode: string,
    @CurrentCustomer() customer: CustomerJwtPayload,
  ) {
    requireVerifiedCustomerId(customer, 'to view the table');
    const table = await this.diningTables.findByCode(tableCode);
    const session = await this.tableSessions.findActiveForTable(table.id);
    return session ? this.tableSessions.findOneDetailed(session.id) : null;
  }

  @Post('companions')
  @ApiOperation({
    summary:
      'Adds another guest (by name + phone) to the table’s session — e.g. one diner adding the rest of their party.',
  })
  async addCompanion(
    @Body() dto: AddCompanionDto,
    @CurrentCustomer() customer: CustomerJwtPayload,
  ) {
    const customerId = requireVerifiedCustomerId(customer, 'to add a guest');
    const table = await this.diningTables.findByCode(dto.tableCode);
    const session = await this.tableSessions.findActiveForTable(table.id);
    if (!session) {
      throw new NotFoundException(`No active session for table ${dto.tableCode}`);
    }
    await this.assertMember(session.id, customerId);
    const companion = await this.customers.findOrCreateByPhone(dto.phone, dto.name);
    return this.tableSessions.addCustomer(session.id, companion.id);
  }

  @Delete('companions/:companionId')
  @ApiOperation({ summary: 'Removes a guest from the table’s session.' })
  async removeCompanion(
    @Param('companionId', ParseIntPipe) companionId: number,
    @Query('tableCode') tableCode: string,
    @CurrentCustomer() customer: CustomerJwtPayload,
  ) {
    const customerId = requireVerifiedCustomerId(customer, 'to manage the party');
    const table = await this.diningTables.findByCode(tableCode);
    const session = await this.tableSessions.findActiveForTable(table.id);
    if (!session) {
      throw new NotFoundException(`No active session for table ${tableCode}`);
    }
    await this.assertMember(session.id, customerId);
    return this.tableSessions.removeCustomer(session.id, companionId);
  }
}
