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
import { AddonGroupsService } from './addon-groups.service';
import { CreateAddonGroupDto } from './dto/create-addon-group.dto';
import { ListAddonGroupsQueryDto } from './dto/list-addon-groups-query.dto';
import { UpdateAddonGroupDto } from './dto/update-addon-group.dto';

@ApiTags('addon-groups')
@ApiBearerAuth()
@Controller('addon-groups')
export class AddonGroupsController {
  constructor(private readonly addonGroupsService: AddonGroupsService) {}

  @Get()
  @RequirePermissions('addon-groups.view')
  @ApiOperation({ summary: 'Lists addon groups (paginated, optional search)' })
  findAll(@Query() query: ListAddonGroupsQueryDto) {
    return this.addonGroupsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('addon-groups.view')
  @ApiOperation({ summary: 'Gets an addon group' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.addonGroupsService.findOne(id);
  }

  @Post()
  @RequirePermissions('addon-groups.manage')
  @ApiOperation({ summary: 'Creates an addon group' })
  create(@Body() dto: CreateAddonGroupDto) {
    return this.addonGroupsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('addon-groups.manage')
  @ApiOperation({ summary: 'Updates an addon group' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddonGroupDto,
  ) {
    return this.addonGroupsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('addon-groups.manage')
  @ApiOperation({ summary: 'Soft-deletes an addon group' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.addonGroupsService.remove(id);
  }
}
