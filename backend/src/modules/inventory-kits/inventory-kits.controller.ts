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
import { CreateInventoryKitDto } from './dto/create-inventory-kit.dto';
import { CreateKitItemDto } from './dto/create-kit-item.dto';
import { CreateKitPortionDto } from './dto/create-kit-portion.dto';
import { ListInventoryKitsQueryDto } from './dto/list-inventory-kits-query.dto';
import { UpdateInventoryKitDto } from './dto/update-inventory-kit.dto';
import { InventoryKitsService } from './inventory-kits.service';

@ApiTags('inventory-kits')
@ApiBearerAuth()
@Controller()
export class InventoryKitsController {
  constructor(private readonly inventoryKitsService: InventoryKitsService) {}

  @Get('inventory-kits')
  @RequirePermissions('inventory-kits.view')
  @ApiOperation({ summary: 'Lists inventory kits (paginated, optional search)' })
  findAll(@Query() query: ListInventoryKitsQueryDto) {
    return this.inventoryKitsService.findAll(query);
  }

  @Get('inventory-kits/:id')
  @RequirePermissions('inventory-kits.view')
  @ApiOperation({ summary: 'Gets an inventory kit' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryKitsService.findOne(id);
  }

  @Post('inventory-kits')
  @RequirePermissions('inventory-kits.manage')
  @ApiOperation({ summary: 'Creates an inventory kit' })
  create(@Body() dto: CreateInventoryKitDto) {
    return this.inventoryKitsService.create(dto);
  }

  @Patch('inventory-kits/:id')
  @RequirePermissions('inventory-kits.manage')
  @ApiOperation({ summary: 'Updates an inventory kit' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInventoryKitDto) {
    return this.inventoryKitsService.update(id, dto);
  }

  @Delete('inventory-kits/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('inventory-kits.manage')
  @ApiOperation({ summary: 'Soft-deletes an inventory kit' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryKitsService.remove(id);
  }

  @Get('inventory-kits/:id/items')
  @RequirePermissions('inventory-kits.view')
  @ApiOperation({ summary: 'Lists the size variances (kit items) of a kit' })
  listItems(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryKitsService.listItems(id);
  }

  @Post('inventory-kits/:id/items')
  @RequirePermissions('inventory-kits.manage')
  @ApiOperation({ summary: 'Adds a size variance (kit item) to a kit' })
  addItem(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateKitItemDto) {
    return this.inventoryKitsService.addItem(id, dto);
  }

  @Delete('inventory-kits/:id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('inventory-kits.manage')
  @ApiOperation({ summary: 'Removes a kit item (and its portions)' })
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.inventoryKitsService.removeItem(id, itemId);
  }

  @Get('inventory-kits/:id/items/:itemId/portions')
  @RequirePermissions('inventory-kits.view')
  @ApiOperation({ summary: 'Lists the sellable portions of a kit item' })
  listPortions(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.inventoryKitsService.listPortions(id, itemId);
  }

  @Post('inventory-kits/:id/items/:itemId/portions')
  @RequirePermissions('inventory-kits.manage')
  @ApiOperation({ summary: 'Adds a sellable portion (e.g. quarter peg) to a kit item' })
  addPortion(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CreateKitPortionDto,
  ) {
    return this.inventoryKitsService.addPortion(id, itemId, dto);
  }

  @Delete('inventory-kits/:id/items/:itemId/portions/:portionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('inventory-kits.manage')
  @ApiOperation({ summary: 'Removes a kit portion' })
  removePortion(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('portionId', ParseIntPipe) portionId: number,
  ) {
    return this.inventoryKitsService.removePortion(id, itemId, portionId);
  }
}
