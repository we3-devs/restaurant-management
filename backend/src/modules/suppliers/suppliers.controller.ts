import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { User } from '../users/entities/user.entity';
import { CreateSupplierCategoryDto, UpdateSupplierCategoryDto } from './dto/create-supplier-category.dto';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  // ---- Categories ----
  @Get('supplier-categories')
  @RequirePermissions('suppliers.view')
  @ApiOperation({ summary: 'Lists all supplier categories' })
  findAllCategories() {
    return this.suppliersService.findAllCategories();
  }

  @Post('supplier-categories')
  @RequirePermissions('suppliers.manage')
  @ApiOperation({ summary: 'Creates a supplier category' })
  createCategory(@Body() dto: CreateSupplierCategoryDto) {
    return this.suppliersService.createCategory(dto);
  }

  @Patch('supplier-categories/:id')
  @RequirePermissions('suppliers.manage')
  @ApiOperation({ summary: 'Updates a supplier category' })
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierCategoryDto) {
    return this.suppliersService.updateCategory(id, dto);
  }

  @Delete('supplier-categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('suppliers.manage')
  @ApiOperation({ summary: 'Deletes a supplier category' })
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.removeCategory(id);
  }

  // ---- Suppliers ----
  @Get('suppliers')
  @RequirePermissions('suppliers.view')
  @ApiOperation({ summary: 'Lists suppliers (paginated, filterable)' })
  findAll(@Query() query: ListSuppliersQueryDto) {
    return this.suppliersService.findAll(query);
  }

  @Get('suppliers/:id')
  @RequirePermissions('suppliers.view')
  @ApiOperation({ summary: 'Gets a supplier with history' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.getHistory(id);
  }

  @Post('suppliers')
  @RequirePermissions('suppliers.manage')
  @ApiOperation({ summary: 'Creates a supplier' })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: User) {
    return this.suppliersService.create(dto, user.id);
  }

  @Patch('suppliers/:id')
  @RequirePermissions('suppliers.manage')
  @ApiOperation({ summary: 'Updates a supplier' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete('suppliers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('suppliers.manage')
  @ApiOperation({ summary: 'Deletes a supplier' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.remove(id);
  }
}
