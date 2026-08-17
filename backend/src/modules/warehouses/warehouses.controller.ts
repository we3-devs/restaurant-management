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
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesService } from './warehouses.service';

@ApiTags('warehouses')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(
    private readonly warehousesService: WarehousesService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get()
  @RequirePermissions('warehouses.view')
  @ApiOperation({
    summary: 'Lists warehouses (paginated, optional search + outletId filter)',
  })
  async findAll(@Query() query: ListWarehousesQueryDto, @CurrentUser() user: User) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, query.outletId);
    }
    return this.warehousesService.findAll(query, accessible);
  }

  @Get(':id')
  @RequirePermissions('warehouses.view')
  @ApiOperation({ summary: 'Gets a warehouse' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const warehouse = await this.warehousesService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, warehouse.outletId);
    return warehouse;
  }

  @Post()
  @RequirePermissions('warehouses.manage')
  @ApiOperation({
    summary:
      'Creates a warehouse (setting isDefault unsets any other default in the same outlet)',
  })
  async create(@Body() dto: CreateWarehouseDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, dto.outletId);
    return this.warehousesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('warehouses.manage')
  @ApiOperation({ summary: 'Updates a warehouse (outletId is immutable)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() user: User,
  ) {
    const warehouse = await this.warehousesService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, warehouse.outletId);
    return this.warehousesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('warehouses.manage')
  @ApiOperation({ summary: 'Soft-deletes a warehouse' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const warehouse = await this.warehousesService.findOne(id);
    await this.outletAccess.assertOutletAccess(user.id, user.isSuperadmin, warehouse.outletId);
    return this.warehousesService.remove(id);
  }
}
