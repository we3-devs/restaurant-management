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
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesService } from './warehouses.service';

@ApiTags('warehouses')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @RequirePermissions('warehouses.view')
  @ApiOperation({
    summary: 'Lists warehouses (paginated, optional search + outletId filter)',
  })
  findAll(@Query() query: ListWarehousesQueryDto) {
    return this.warehousesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('warehouses.view')
  @ApiOperation({ summary: 'Gets a warehouse' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.warehousesService.findOne(id);
  }

  @Post()
  @RequirePermissions('warehouses.manage')
  @ApiOperation({
    summary:
      'Creates a warehouse (setting isDefault unsets any other default in the same outlet)',
  })
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('warehouses.manage')
  @ApiOperation({ summary: 'Updates a warehouse (outletId is immutable)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehousesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('warehouses.manage')
  @ApiOperation({ summary: 'Soft-deletes a warehouse' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.warehousesService.remove(id);
  }
}
