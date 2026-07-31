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
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerOutletDto } from './dto/update-customer-outlet.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

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
    return this.customersService.findOne(id);
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
  listOutlets(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.listOutlets(id);
  }

  @Patch(':id/outlets/:outletId')
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: "Toggles a customer's favorite-outlet flag" })
  updateOutlet(
    @Param('id', ParseIntPipe) id: number,
    @Param('outletId', ParseIntPipe) outletId: number,
    @Body() dto: UpdateCustomerOutletDto,
  ) {
    return this.customersService.updateOutlet(id, outletId, dto);
  }
}
