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
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { ListIngredientsQueryDto } from './dto/list-ingredients-query.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { IngredientsService } from './ingredients.service';

@ApiTags('ingredients')
@ApiBearerAuth()
@Controller('ingredients')
export class IngredientsController {
  constructor(
    private readonly ingredientsService: IngredientsService,
    private readonly outletAccess: OutletAccessService,
  ) {}

  @Get()
  @RequirePermissions('ingredients.view')
  @ApiOperation({
    summary:
      'Lists ingredients (paginated, optional search + outletId/ingredientCategoryId/type filters)',
  })
  async findAll(
    @Query() query: ListIngredientsQueryDto,
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
    return this.ingredientsService.findAll(query, accessible);
  }

  @Get(':id')
  @RequirePermissions('ingredients.view')
  @ApiOperation({ summary: 'Gets an ingredient' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const ingredient = await this.ingredientsService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      ingredient.outletId,
    );
    return ingredient;
  }

  @Post()
  @RequirePermissions('ingredients.manage')
  @ApiOperation({ summary: 'Creates an ingredient' })
  async create(@Body() dto: CreateIngredientDto, @CurrentUser() user: User) {
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      dto.outletId,
    );
    return this.ingredientsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('ingredients.manage')
  @ApiOperation({ summary: 'Updates an ingredient (baseUnitId/outletId are immutable)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIngredientDto,
    @CurrentUser() user: User,
  ) {
    const ingredient = await this.ingredientsService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      ingredient.outletId,
    );
    return this.ingredientsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('ingredients.manage')
  @ApiOperation({ summary: 'Soft-deletes an ingredient' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const ingredient = await this.ingredientsService.findOne(id);
    await this.outletAccess.assertOutletAccess(
      user.id,
      user.isSuperadmin,
      ingredient.outletId,
    );
    return this.ingredientsService.remove(id);
  }
}
