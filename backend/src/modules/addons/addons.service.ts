import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { AddonGroupsService } from '../addon-groups/addon-groups.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { UnitsService } from '../units/units.service';
import { Addon } from './entities/addon.entity';
import { AddonRecipe } from './entities/addon-recipe.entity';
import { CreateAddonRecipeDto } from './dto/create-addon-recipe.dto';
import { CreateAddonDto } from './dto/create-addon.dto';
import { ListAddonsQueryDto } from './dto/list-addons-query.dto';
import { UpdateAddonRecipeDto } from './dto/update-addon-recipe.dto';
import { UpdateAddonDto } from './dto/update-addon.dto';

@Injectable()
export class AddonsService {
  constructor(
    @InjectRepository(Addon)
    private readonly addonsRepository: Repository<Addon>,
    @InjectRepository(AddonRecipe)
    private readonly addonRecipesRepository: Repository<AddonRecipe>,
    private readonly addonGroupsService: AddonGroupsService,
    private readonly ingredientsService: IngredientsService,
    private readonly unitsService: UnitsService,
  ) {}

  async findAll(query: ListAddonsQueryDto): Promise<PaginatedResponse<Addon>> {
    const { page, limit, search, addonGroupId } = query;
    const where: FindOptionsWhere<Addon> = {};
    if (addonGroupId !== undefined) {
      where.addonGroupId = addonGroupId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [addons, total] = await this.addonsRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: addons,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: number): Promise<Addon> {
    const addon = await this.addonsRepository.findOne({ where: { id } });
    if (!addon) {
      throw new NotFoundException(`Addon ${id} not found`);
    }
    return addon;
  }

  async create(dto: CreateAddonDto): Promise<Addon> {
    if (dto.addonGroupId !== undefined) {
      await this.addonGroupsService.findOne(dto.addonGroupId);
    }

    const addon = this.addonsRepository.create({
      addonGroupId: dto.addonGroupId ?? null,
      name: dto.name,
      price: dto.price ?? 0,
      sortOrder: dto.sortOrder ?? 0,
      isRecipeEnabled: dto.isRecipeEnabled ?? false,
    });
    return this.addonsRepository.save(addon);
  }

  async update(id: number, dto: UpdateAddonDto): Promise<Addon> {
    const addon = await this.findOne(id);

    if (dto.addonGroupId !== undefined) {
      if (dto.addonGroupId !== null) {
        await this.addonGroupsService.findOne(dto.addonGroupId);
      }
      addon.addonGroupId = dto.addonGroupId;
    }

    Object.assign(addon, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isRecipeEnabled !== undefined && {
        isRecipeEnabled: dto.isRecipeEnabled,
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    return this.addonsRepository.save(addon);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    // deleted_at column present — soft delete avoids the order_item_addons
    // RESTRICT FK (no entity yet, but the real table already enforces it).
    await this.addonsRepository.softDelete(id);
  }

  // ------------------------------------------------------------------ recipes

  async listRecipes(addonId: number): Promise<AddonRecipe[]> {
    await this.findOne(addonId);
    return this.addonRecipesRepository.find({ where: { addonId } });
  }

  async addRecipe(
    addonId: number,
    dto: CreateAddonRecipeDto,
  ): Promise<AddonRecipe> {
    await this.findOne(addonId);
    await this.ingredientsService.findOne(dto.ingredientId);
    await this.unitsService.findOne(dto.unitId);

    const recipe = this.addonRecipesRepository.create({
      addonId,
      ingredientId: dto.ingredientId,
      unitId: dto.unitId,
      quantity: dto.quantity,
      wastageQuantity: dto.wastageQuantity ?? 0,
    });

    try {
      return await this.addonRecipesRepository.save(recipe);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'A recipe row for this addon/ingredient/unit combination already exists',
        );
      }
      throw error;
    }
  }

  async updateRecipe(
    addonId: number,
    recipeId: number,
    dto: UpdateAddonRecipeDto,
  ): Promise<AddonRecipe> {
    const recipe = await this.findRecipe(addonId, recipeId);

    Object.assign(recipe, {
      ...(dto.quantity !== undefined && { quantity: dto.quantity }),
      ...(dto.wastageQuantity !== undefined && {
        wastageQuantity: dto.wastageQuantity,
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    return this.addonRecipesRepository.save(recipe);
  }

  async removeRecipe(addonId: number, recipeId: number): Promise<void> {
    const recipe = await this.findRecipe(addonId, recipeId);
    await this.addonRecipesRepository.remove(recipe);
  }

  /** Used by OrdersService to resolve required ingredients for an addon. */
  async resolveRecipes(addonId: number): Promise<AddonRecipe[]> {
    return this.addonRecipesRepository.find({
      where: { addonId, isActive: true },
    });
  }

  private async findRecipe(
    addonId: number,
    recipeId: number,
  ): Promise<AddonRecipe> {
    const recipe = await this.addonRecipesRepository.findOne({
      where: { id: recipeId, addonId },
    });
    if (!recipe) {
      throw new NotFoundException(
        `Recipe ${recipeId} not found on addon ${addonId}`,
      );
    }
    return recipe;
  }
}
