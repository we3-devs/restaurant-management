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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';
import { VariantsService } from './variants.service';

/**
 * The global variant list (chicken, veg, egg). Its sub-variant twin lives in
 * SubVariantsController — separate controllers because a single one would need
 * a dynamic path segment for the list name, and @RequirePermissions plus the
 * public-route decorators resolve per route, not per request.
 */
@ApiTags('variants')
@ApiBearerAuth()
@Controller('variants')
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  // Guests need the names to render the menu's option pickers.
  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Lists active variants for the guest menu' })
  async findAllPublic() {
    const rows = await this.variantsService.findAll('variant');
    return rows
      .filter((row) => row.isActive)
      .map(({ id, name, sortOrder }) => ({ id, name, sortOrder }));
  }

  @Get()
  @RequirePermissions('food-variants.view')
  @ApiOperation({ summary: 'Lists all variants' })
  findAll() {
    return this.variantsService.findAll('variant');
  }

  @Post()
  @RequirePermissions('food-variants.manage')
  @ApiOperation({ summary: 'Adds a variant, usable by every food' })
  create(@Body() dto: CreateVariantDto) {
    return this.variantsService.create('variant', dto);
  }

  @Patch(':id')
  @RequirePermissions('food-variants.manage')
  @ApiOperation({ summary: 'Renames a variant everywhere it is used' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVariantDto) {
    return this.variantsService.update('variant', id, dto);
  }

  @Delete(':id')
  @RequirePermissions('food-variants.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletes a variant, if no food item uses it' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.variantsService.remove('variant', id);
  }
}

@ApiTags('sub-variants')
@ApiBearerAuth()
@Controller('sub-variants')
export class SubVariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Lists active sub-variants for the guest menu' })
  async findAllPublic() {
    const rows = await this.variantsService.findAll('sub-variant');
    return rows
      .filter((row) => row.isActive)
      .map(({ id, name, sortOrder }) => ({ id, name, sortOrder }));
  }

  @Get()
  @RequirePermissions('food-variants.view')
  @ApiOperation({ summary: 'Lists all sub-variants' })
  findAll() {
    return this.variantsService.findAll('sub-variant');
  }

  @Post()
  @RequirePermissions('food-variants.manage')
  @ApiOperation({ summary: 'Adds a sub-variant, usable by every food' })
  create(@Body() dto: CreateVariantDto) {
    return this.variantsService.create('sub-variant', dto);
  }

  @Patch(':id')
  @RequirePermissions('food-variants.manage')
  @ApiOperation({ summary: 'Renames a sub-variant everywhere it is used' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVariantDto) {
    return this.variantsService.update('sub-variant', id, dto);
  }

  @Delete(':id')
  @RequirePermissions('food-variants.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletes a sub-variant, if no food item uses it' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.variantsService.remove('sub-variant', id);
  }
}
