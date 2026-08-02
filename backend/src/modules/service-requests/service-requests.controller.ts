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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Guest Call-Waiter request from the QR page — resolves the table by its printed code, no auth',
  })
  createFromGuest(@Body() dto: CreateGuestServiceRequestDto) {
    return this.serviceRequestsService.createFromGuest(dto);
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
