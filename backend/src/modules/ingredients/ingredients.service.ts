import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  ILike,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { IngredientCategoriesService } from '../ingredient-categories/ingredient-categories.service';
import { OutletsService } from '../outlets/outlets.service';
import { UnitsService } from '../units/units.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { ListIngredientsQueryDto } from './dto/list-ingredients-query.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';
import {
  isTrackableIngredientType,
  TRACKED_INGREDIENT_TYPES,
} from '../ingredient-categories/ingredient-category-type.util';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientsRepository: Repository<Ingredient>,
    private readonly unitsService: UnitsService,
    private readonly ingredientCategoriesService: IngredientCategoriesService,
    private readonly outletsService: OutletsService,
  ) {}

  async findAll(
    query: ListIngredientsQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<Ingredient>> {
    const { page, limit, search, outletId, ingredientCategoryId, type, trackableOnly } =
      query;
    const where: FindOptionsWhere<Ingredient> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    } else if (accessibleOutletIds !== 'ALL') {
      where.outletId = In(accessibleOutletIds);
    }
    if (ingredientCategoryId !== undefined) {
      where.ingredientCategoryId = ingredientCategoryId;
    }
    if (type !== undefined) {
      where.category = { type };
    } else if (trackableOnly) {
      where.category = { type: In(TRACKED_INGREDIENT_TYPES) };
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [ingredients, total] = await this.ingredientsRepository.findAndCount({
      where,
      relations: { category: true, outlet: { tenant: true } },
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
      relations: { category: true, outlet: { tenant: true } },
    });
    if (!ingredient) {
      throw new NotFoundException(`Ingredient ${id} not found`);
    }
    return ingredient;
  }

  /** Throws when the ingredient's category's type doesn't support stock tracking (raw_material, ready_product). */
  assertTrackable(ingredient: Ingredient): void {
    if (!isTrackableIngredientType(ingredient.category.type)) {
      throw new BadRequestException(
        `Ingredient "${ingredient.name}" (type: ${ingredient.category.type}) does not support stock tracking.`,
      );
    }
  }

  async create(dto: CreateIngredientDto): Promise<Ingredient> {
    await this.outletsService.findOne(dto.outletId);
    await this.unitsService.findOne(dto.baseUnitId);
    if (dto.defaultPurchaseUnitId !== undefined) {
      await this.unitsService.findOne(dto.defaultPurchaseUnitId);
    }
    if (dto.defaultUsageUnitId !== undefined) {
      await this.unitsService.findOne(dto.defaultUsageUnitId);
    }
    await this.ingredientCategoriesService.findOne(dto.ingredientCategoryId);

    const ingredient = this.ingredientsRepository.create({
      outletId: dto.outletId,
      ingredientCategoryId: dto.ingredientCategoryId,
      name: dto.name,
      slug: dto.slug,
      code: dto.code,
      buyingPrice: dto.buyingPrice ?? 0,
      sellingPrice: dto.sellingPrice ?? 0,
      barcode: dto.barcode ?? null,
      image: dto.image ?? null,
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
      await this.ingredientCategoriesService.findOne(dto.ingredientCategoryId);
      ingredient.ingredientCategoryId = dto.ingredientCategoryId;
    }

    Object.assign(ingredient, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.buyingPrice !== undefined && { buyingPrice: dto.buyingPrice }),
      ...(dto.sellingPrice !== undefined && { sellingPrice: dto.sellingPrice }),
      ...(dto.barcode !== undefined && { barcode: dto.barcode }),
      ...(dto.image !== undefined && { image: dto.image }),
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
