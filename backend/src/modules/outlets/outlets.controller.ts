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
import { CreateOutletDto } from './dto/create-outlet.dto';
import { ListOutletsQueryDto } from './dto/list-outlets-query.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { OutletsService } from './outlets.service';

@ApiTags('outlets')
@ApiBearerAuth()
@Controller('outlets')
export class OutletsController {
  constructor(private readonly outletsService: OutletsService) {}

  @Get()
  @RequirePermissions('outlets.view')
  @ApiOperation({ summary: 'Lists outlets (paginated, optional search)' })
  findAll(@Query() query: ListOutletsQueryDto) {
    return this.outletsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('outlets.view')
  @ApiOperation({ summary: 'Gets an outlet' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.outletsService.findOne(id);
  }

  @Post()
  @RequirePermissions('outlets.manage')
  @ApiOperation({ summary: 'Creates an outlet' })
  create(@Body() dto: CreateOutletDto) {
    return this.outletsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('outlets.manage')
  @ApiOperation({ summary: 'Updates an outlet' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOutletDto) {
    return this.outletsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('outlets.manage')
  @ApiOperation({
    summary:
      'Deletes an outlet (409 if departments/warehouses/orders/etc. still reference it)',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.outletsService.remove(id);
  }
}
