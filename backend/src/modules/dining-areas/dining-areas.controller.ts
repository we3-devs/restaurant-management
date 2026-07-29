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
import { DiningAreasService } from './dining-areas.service';
import { CreateDiningAreaDto } from './dto/create-dining-area.dto';
import { ListDiningAreasQueryDto } from './dto/list-dining-areas-query.dto';
import { UpdateDiningAreaDto } from './dto/update-dining-area.dto';

@ApiTags('dining-areas')
@ApiBearerAuth()
@Controller('dining-areas')
export class DiningAreasController {
  constructor(private readonly diningAreasService: DiningAreasService) {}

  @Get()
  @RequirePermissions('dining-areas.view')
  @ApiOperation({
    summary:
      'Lists dining areas (paginated, optional search + outletId filter)',
  })
  findAll(@Query() query: ListDiningAreasQueryDto) {
    return this.diningAreasService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('dining-areas.view')
  @ApiOperation({ summary: 'Gets a dining area' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.diningAreasService.findOne(id);
  }

  @Post()
  @RequirePermissions('dining-areas.manage')
  @ApiOperation({ summary: 'Creates a dining area' })
  create(@Body() dto: CreateDiningAreaDto) {
    return this.diningAreasService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('dining-areas.manage')
  @ApiOperation({ summary: 'Updates a dining area (outletId is immutable)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiningAreaDto,
  ) {
    return this.diningAreasService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('dining-areas.manage')
  @ApiOperation({
    summary:
      'Deletes a dining area (cascades its dining tables — no soft delete)',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.diningAreasService.remove(id);
  }
}
