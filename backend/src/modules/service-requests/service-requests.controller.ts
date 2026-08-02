import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentCustomer } from '../customer-auth/decorators/current-customer.decorator';
import { CustomerJwtAuthGuard } from '../customer-auth/guards/customer-jwt-auth.guard';
import { requireVerifiedCustomerId } from '../customer-auth/require-verified-customer.util';
import type { CustomerJwtPayload } from '../customer-auth/types/customer-jwt-payload';
import { User } from '../users/entities/user.entity';
import { CreateGuestServiceRequestDto } from './dto/create-guest-service-request.dto';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { ListServiceRequestsQueryDto } from './dto/list-service-requests-query.dto';
import { ServiceRequestsService } from './service-requests.service';

@ApiTags('service-requests')
@ApiBearerAuth()
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  @Post('guest')
  @Public()
  @UseGuards(CustomerJwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Guest Call-Waiter request from the QR page — requires an OTP-verified customer session. Resolves the table by its printed code and opens/attaches a table session (source: qr_order), same as guest ordering.',
  })
  createFromGuest(
    @Body() dto: CreateGuestServiceRequestDto,
    @CurrentCustomer() customer: CustomerJwtPayload,
  ) {
    const customerId = requireVerifiedCustomerId(customer, 'to call staff');
    return this.serviceRequestsService.createFromGuest(dto, customerId);
  }

  @Get()
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary:
      'Lists service requests (paginated, outletId/diningTableId/status filters, newest pending first)',
  })
  findAll(@Query() query: ListServiceRequestsQueryDto) {
    return this.serviceRequestsService.findAll(query);
  }

  @Post()
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary:
      'Staff-initiated Call-Waiter request (e.g. from the Floor table dialog)',
  })
  create(@Body() dto: CreateServiceRequestDto, @CurrentUser() user: User) {
    return this.serviceRequestsService.create(dto, user.id);
  }

  @Post(':id/resolve')
  @RequirePermissions('orders.manage')
  @ApiOperation({
    summary: 'Marks a service request as resolved (attended to)',
  })
  resolve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.serviceRequestsService.resolve(id, user.id);
  }
}
