import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { IngredientCategoriesService } from '../ingredient-categories/ingredient-categories.service';
import { UnitsService } from '../units/units.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { ListIngredientsQueryDto } from './dto/list-ingredients-query.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientsRepository: Repository<Ingredient>,
    private readonly unitsService: UnitsService,
    private readonly ingredientCategoriesService: IngredientCategoriesService,
  ) {}

  async findAll(
    query: ListIngredientsQueryDto,
  ): Promise<PaginatedResponse<Ingredient>> {
    const { page, limit, search, ingredientCategoryId, type } = query;
    const where: FindOptionsWhere<Ingredient> = {};
    if (ingredientCategoryId !== undefined) {
      where.ingredientCategoryId = ingredientCategoryId;
    }
    if (type !== undefined) {
      where.type = type;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [ingredients, total] = await this.ingredientsRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: ingredients,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by the stock-movement document services. */
  async findOne(id: number): Promise<Ingredient> {
    const ingredient = await this.ingredientsRepository.findOne({
      where: { id },
    });
    if (!ingredient) {
      throw new NotFoundException(`Ingredient ${id} not found`);
    }
    return ingredient;
  }

  async create(dto: CreateIngredientDto): Promise<Ingredient> {
    await this.unitsService.findOne(dto.baseUnitId);
    if (dto.defaultPurchaseUnitId !== undefined) {
      await this.unitsService.findOne(dto.defaultPurchaseUnitId);
    }
    if (dto.defaultUsageUnitId !== undefined) {
      await this.unitsService.findOne(dto.defaultUsageUnitId);
    }
    if (dto.ingredientCategoryId !== undefined) {
      await this.ingredientCategoriesService.findOne(dto.ingredientCategoryId);
    }

    const ingredient = this.ingredientsRepository.create({
      ingredientCategoryId: dto.ingredientCategoryId ?? null,
      name: dto.name,
      slug: dto.slug,
      code: dto.code,
      barcode: dto.barcode ?? null,
      image: dto.image ?? null,
      type: dto.type ?? 'raw_material',
      baseUnitId: dto.baseUnitId,
      defaultPurchaseUnitId: dto.defaultPurchaseUnitId ?? null,
      defaultUsageUnitId: dto.defaultUsageUnitId ?? null,
      minimumStock: dto.minimumStock ?? 0,
      reorderLevel: dto.reorderLevel ?? 0,
      reorderQuantity: dto.reorderQuantity ?? 0,
      costingMethod: dto.costingMethod ?? 'fifo',
      isPerishable: dto.isPerishable ?? false,
      trackExpiry: dto.trackExpiry ?? false,
      description: dto.description ?? null,
    });

    try {
      return await this.ingredientsRepository.save(ingredient);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Ingredient slug "${dto.slug}", code "${dto.code}", or barcode is already in use`,
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateIngredientDto): Promise<Ingredient> {
    const ingredient = await this.findOne(id);

    if (dto.defaultPurchaseUnitId !== undefined) {
      if (dto.defaultPurchaseUnitId !== null) {
        await this.unitsService.findOne(dto.defaultPurchaseUnitId);
      }
      ingredient.defaultPurchaseUnitId = dto.defaultPurchaseUnitId;
    }
    if (dto.defaultUsageUnitId !== undefined) {
      if (dto.defaultUsageUnitId !== null) {
        await this.unitsService.findOne(dto.defaultUsageUnitId);
      }
      ingredient.defaultUsageUnitId = dto.defaultUsageUnitId;
    }
    if (dto.ingredientCategoryId !== undefined) {
      if (dto.ingredientCategoryId !== null) {
        await this.ingredientCategoriesService.findOne(
          dto.ingredientCategoryId,
        );
      }
      ingredient.ingredientCategoryId = dto.ingredientCategoryId;
    }

    Object.assign(ingredient, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.barcode !== undefined && { barcode: dto.barcode }),
      ...(dto.image !== undefined && { image: dto.image }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.minimumStock !== undefined && { minimumStock: dto.minimumStock }),
      ...(dto.reorderLevel !== undefined && { reorderLevel: dto.reorderLevel }),
      ...(dto.reorderQuantity !== undefined && {
        reorderQuantity: dto.reorderQuantity,
      }),
      ...(dto.costingMethod !== undefined && {
        costingMethod: dto.costingMethod,
      }),
      ...(dto.isPerishable !== undefined && { isPerishable: dto.isPerishable }),
      ...(dto.trackExpiry !== undefined && { trackExpiry: dto.trackExpiry }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      return await this.ingredientsRepository.save(ingredient);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Ingredient code, slug, or barcode is already in use`,
        );
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.ingredientsRepository.softDelete(id);
  }
}
