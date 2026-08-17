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
import { DiningAreasService } from './dining-areas.service';
import { CreateDiningAreaDto } from './dto/create-dining-area.dto';
import { ListDiningAreasQueryDto } from './dto/list-dining-areas-query.dto';
import { UpdateDiningAreaDto } from './dto/update-dining-area.dto';

@ApiTags('dining-areas')
@ApiBearerAuth()
@Controller('dining-areas')
export class DiningAreasController {
  constructor(
    private readonly diningAreasService: DiningAreasService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get()
  @RequirePermissions('dining-areas.view')
  @ApiOperation({
    summary:
      'Lists dining areas (paginated, optional search + outletId filter)',
  })
  async findAll(
    @Query() query: ListDiningAreasQueryDto,
    @CurrentUser() user: User,
  ) {
    const accessible = await this.outletAccess.getAccessibleOutletIds(
      user.id,
      user.isSuperadmin,
    );
    if (accessible !== 'ALL' && query.outletId !== undefined) {
      await this.outletAccess.assertOutletAccess(
        user.id,
        user.isSuperadmin,
        query.outletId,
      );
    }
    return this.diningAreasService.findAll(query, accessible);
  }

  @Get(':id')
  @RequirePermissions('dining-areas.view')
  @ApiOperation({ summary: 'Gets a dining area' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const area = await this.diningAreasService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      area.outletId,
    );
    return area;
  }

  @Post()
  @RequirePermissions('dining-areas.manage')
  @ApiOperation({ summary: 'Creates a dining area' })
  async create(@Body() dto: CreateDiningAreaDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      dto.outletId,
    );
    return this.diningAreasService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('dining-areas.manage')
  @ApiOperation({ summary: 'Updates a dining area (outletId is immutable)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiningAreaDto,
    @CurrentUser() user: User,
  ) {
    const area = await this.diningAreasService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      area.outletId,
    );
    return this.diningAreasService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('dining-areas.manage')
  @ApiOperation({
    summary:
      'Deletes a dining area (cascades its dining tables — no soft delete)',
  })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const area = await this.diningAreasService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      area.outletId,
    );
    return this.diningAreasService.remove(id);
  }
}
