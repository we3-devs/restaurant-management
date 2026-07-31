import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { ListPurchaseReturnsQueryDto } from './dto/list-purchase-returns-query.dto';
import { PurchaseReturnsService } from './purchase-returns.service';

@ApiTags('purchase-returns')
@ApiBearerAuth()
@Controller('purchase-returns')
export class PurchaseReturnsController {
  constructor(private readonly prService: PurchaseReturnsService) {}

  @Get() @RequirePermissions('purchase-returns.view')
  @ApiOperation({ summary: 'Lists purchase returns (paginated, filterable)' })
  findAll(@Query() query: ListPurchaseReturnsQueryDto) { return this.prService.findAll(query); }

  @Get(':id') @RequirePermissions('purchase-returns.view')
  @ApiOperation({ summary: 'Gets a purchase return' })
  findOne(@Param('id', ParseIntPipe) id: number) { return this.prService.findOne(id); }

  @Post() @RequirePermissions('purchase-returns.manage')
  @ApiOperation({ summary: 'Creates a draft purchase return' })
  create(@Body() dto: CreatePurchaseReturnDto, @CurrentUser() user: User) { return this.prService.create(dto, user.id); }

  @Post(':id/process') @RequirePermissions('purchase-returns.manage')
  @ApiOperation({ summary: 'Processes a purchase return (updates inventory)' })
  process(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) { return this.prService.process(id, user.id); }

  @Post(':id/cancel') @HttpCode(HttpStatus.OK) @RequirePermissions('purchase-returns.manage')
  @ApiOperation({ summary: 'Cancels a draft purchase return' })
  cancel(@Param('id', ParseIntPipe) id: number) { return this.prService.cancel(id); }

  @Get(':id/items') @RequirePermissions('purchase-returns.view')
  @ApiOperation({ summary: "Lists a purchase return's items" })
  listItems(@Param('id', ParseIntPipe) id: number) { return this.prService.listItems(id); }
}
