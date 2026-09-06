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
import { CreateUnitConversionDto } from './dto/create-unit-conversion.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { ListUnitsQueryDto } from './dto/list-units-query.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@ApiTags('units')
@ApiBearerAuth()
@Controller()
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get('units')
  @RequirePermissions('units.view')
  @ApiOperation({
    summary: 'Lists units (paginated, optional search + type filter)',
  })
  findAll(@Query() query: ListUnitsQueryDto) {
    return this.unitsService.findAll(query);
  }

  @Get('units/:id')
  @RequirePermissions('units.view')
  @ApiOperation({ summary: 'Gets a unit' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.findOne(id);
  }

  @Post('units')
  @RequirePermissions('units.manage')
  @ApiOperation({ summary: 'Creates a unit' })
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Patch('units/:id')
  @RequirePermissions('units.manage')
  @ApiOperation({ summary: 'Updates a unit' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUnitDto) {
    return this.unitsService.update(id, dto);
  }

  @Delete('units/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('units.manage')
  @ApiOperation({ summary: 'Soft-deletes a unit' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.remove(id);
  }

  @Get('units/:id/conversions')
  @RequirePermissions('units.view')
  @ApiOperation({ summary: 'Lists conversions from a unit' })
  listConversions(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.listConversions(id);
  }

  @Post('units/:id/conversions')
  @RequirePermissions('units.manage')
  @ApiOperation({ summary: 'Adds a conversion from a unit to another unit' })
  addConversion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateUnitConversionDto,
  ) {
    return this.unitsService.addConversion(id, dto);
  }

  @Delete('unit-conversions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('units.manage')
  @ApiOperation({ summary: 'Removes a unit conversion' })
  removeConversion(@Param('id', ParseIntPipe) id: number) {
    return this.unitsService.removeConversion(id);
  }
}
