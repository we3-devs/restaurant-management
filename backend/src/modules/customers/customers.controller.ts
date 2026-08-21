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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerOutletDto } from './dto/update-customer-outlet.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get()
  @RequirePermissions('customers.view')
  @ApiOperation({
    summary: 'Lists customers (paginated, optional search by name/phone/email)',
  })
  findAll(@Query() query: ListCustomersQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('customers.view')
  @ApiOperation({ summary: 'Gets a customer' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.findOneResponse(id);
  }

  @Post()
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: 'Creates a customer' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: 'Updates a customer' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: 'Soft-deletes a customer' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.remove(id);
  }

  @Get(':id/outlets')
  @RequirePermissions('customers.view')
  @ApiOperation({ summary: "Lists a customer's per-outlet visit stats" })
  async listOutlets(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    return this.customersService.listOutlets(id, accessible);
  }

  @Patch(':id/outlets/:outletId')
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: "Toggles a customer's favorite-outlet flag" })
  async updateOutlet(
    @Param('id', ParseIntPipe) id: number,
    @Param('outletId', ParseIntPipe) outletId: number,
    @Body() dto: UpdateCustomerOutletDto,
    @CurrentUser() user: User,
  ) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, outletId);
    return this.customersService.updateOutlet(id, outletId, dto);
  }
}
