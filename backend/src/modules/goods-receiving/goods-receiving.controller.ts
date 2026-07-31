import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { CreateGoodsReceivingDto } from './dto/create-goods-receiving.dto';
import { ListGoodsReceivingQueryDto } from './dto/list-goods-receiving-query.dto';
import { GoodsReceivingService } from './goods-receiving.service';

@ApiTags('goods-receiving')
@ApiBearerAuth()
@Controller('goods-receiving')
export class GoodsReceivingController {
  constructor(private readonly grnService: GoodsReceivingService) {}

  @Get() @RequirePermissions('goods-receiving.view')
  @ApiOperation({ summary: 'Lists goods receiving (paginated, filterable)' })
  findAll(@Query() query: ListGoodsReceivingQueryDto) { return this.grnService.findAll(query); }

  @Get(':id') @RequirePermissions('goods-receiving.view')
  @ApiOperation({ summary: 'Gets a goods receiving record' })
  findOne(@Param('id', ParseIntPipe) id: number) { return this.grnService.findOne(id); }

  @Post() @RequirePermissions('goods-receiving.manage')
  @ApiOperation({ summary: 'Creates a goods receiving (updates inventory, PO status)' })
  create(@Body() dto: CreateGoodsReceivingDto, @CurrentUser() user: User) { return this.grnService.create(dto, user.id); }

  @Post(':id/cancel') @HttpCode(HttpStatus.OK) @RequirePermissions('goods-receiving.manage')
  @ApiOperation({ summary: 'Cancels a draft goods receiving' })
  cancel(@Param('id', ParseIntPipe) id: number) { return this.grnService.cancel(id); }

  @Get(':id/items') @RequirePermissions('goods-receiving.view')
  @ApiOperation({ summary: "Lists a goods receiving's items" })
  listItems(@Param('id', ParseIntPipe) id: number) { return this.grnService.listItems(id); }
}
