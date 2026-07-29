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
import { CreateOutletDepartmentDto } from './dto/create-outlet-department.dto';
import { ListOutletDepartmentsQueryDto } from './dto/list-outlet-departments-query.dto';
import { UpdateOutletDepartmentDto } from './dto/update-outlet-department.dto';
import { OutletDepartmentsService } from './outlet-departments.service';

@ApiTags('outlet-departments')
@ApiBearerAuth()
@Controller('outlet-departments')
export class OutletDepartmentsController {
  constructor(
    private readonly outletDepartmentsService: OutletDepartmentsService,
  ) {}

  @Get()
  @RequirePermissions('outlet-departments.view')
  @ApiOperation({
    summary:
      'Lists outlet departments (paginated, optional search + outletId filter)',
  })
  findAll(@Query() query: ListOutletDepartmentsQueryDto) {
    return this.outletDepartmentsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('outlet-departments.view')
  @ApiOperation({ summary: 'Gets an outlet department' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.outletDepartmentsService.findOne(id);
  }

  @Post()
  @RequirePermissions('outlet-departments.manage')
  @ApiOperation({ summary: 'Creates an outlet department' })
  create(@Body() dto: CreateOutletDepartmentDto) {
    return this.outletDepartmentsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('outlet-departments.manage')
  @ApiOperation({
    summary: 'Updates an outlet department (outletId is immutable)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOutletDepartmentDto,
  ) {
    return this.outletDepartmentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('outlet-departments.manage')
  @ApiOperation({ summary: 'Soft-deletes an outlet department' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.outletDepartmentsService.remove(id);
  }
}
