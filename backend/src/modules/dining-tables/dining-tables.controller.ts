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
import { DiningTablesService } from './dining-tables.service';
import { CreateDiningTableDto } from './dto/create-dining-table.dto';
import { ListDiningTablesQueryDto } from './dto/list-dining-tables-query.dto';
import { UpdateDiningTableDto } from './dto/update-dining-table.dto';

@ApiTags('dining-tables')
@ApiBearerAuth()
@Controller('dining-tables')
export class DiningTablesController {
  constructor(private readonly diningTablesService: DiningTablesService) {}

  @Get()
  @RequirePermissions('dining-tables.view')
  @ApiOperation({
    summary:
      'Lists dining tables (paginated, optional search + outletId/diningAreaId/status filters)',
  })
  findAll(@Query() query: ListDiningTablesQueryDto) {
    return this.diningTablesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('dining-tables.view')
  @ApiOperation({ summary: 'Gets a dining table' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.diningTablesService.findOne(id);
  }

  @Post()
  @RequirePermissions('dining-tables.manage')
  @ApiOperation({ summary: 'Creates a dining table' })
  create(@Body() dto: CreateDiningTableDto) {
    return this.diningTablesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('dining-tables.manage')
  @ApiOperation({
    summary: 'Updates a dining table (outletId/diningAreaId are immutable)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiningTableDto,
  ) {
    return this.diningTablesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('dining-tables.manage')
  @ApiOperation({ summary: 'Deletes a dining table (no soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.diningTablesService.remove(id);
  }
}
