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
import { MoveIngredientDto } from './dto/move-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';
import {
  isTrackableIngredientType,
  TRACKED_INGREDIENT_TYPES,
} from '../ingredient-categories/ingredient-category-type.util';
import { TenantContext } from '../../common/tenant/tenant-context';
import { scopedWhere, tenantFields } from '../../common/tenant/tenant-scope';


/**
 * Column lengths the released identifiers have to keep fitting into — see
 * Ingredient's @Column definitions.
 */
const IDENTIFIER_LENGTHS = { code: 80, slug: 255, barcode: 255 } as const;

/**
 * Stamps a deleted row's identifier so it stops occupying the value.
 * The id keeps it unique even if the same base value is deleted twice, and
 * the base is trimmed (not the suffix) when the two together would overflow
 * the column.
 */
function releasedIdentifier(value: string, id: number, maxLength: number): string {
  const suffix = `-deleted-${id}`;
  return `${value.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`;
}

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientsRepository: Repository<Ingredient>,
    private readonly unitsService: UnitsService,
    private readonly ingredientCategoriesService: IngredientCategoriesService,
    private readonly outletsService: OutletsService,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(
    query: ListIngredientsQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<Ingredient>> {
    const { page, limit, search, outletId, ingredientCategoryId, type, trackableOnly } =
      query;
    let where: FindOptionsWhere<Ingredient> = {};
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
    where = scopedWhere(this.tenantContext, where);

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

  /** Bulk lookup used by OrdersService reservation calculations to avoid one DB round trip per recipe row. */
  async findByIds(ids: number[]): Promise<Ingredient[]> {
    if (ids.length === 0) return [];
    return this.ingredientsRepository.find({
      where: scopedWhere(this.tenantContext, { id: In(ids) }),
      relations: { category: true, outlet: { tenant: true } },
    });
  }

  /** Internal lookup used by the stock-movement document services. */
  async findOne(id: number): Promise<Ingredient> {
    const ingredient = await this.ingredientsRepository.findOne({
      where: scopedWhere(this.tenantContext, { id }),
      relations: { category: true, outlet: { tenant: true } },
    });
    if (!ingredient) {
      throw new NotFoundException(`Ingredient ${id} not found`);
    }
    return ingredient;
  }

  /**
   * Throws when the ingredient's category type doesn't carry warehouse stock.
   * Tracked: beverage, packaging, consumable. Untracked: raw_material,
   * ready_product — those are consumed through recipes, not counted in a
   * warehouse, so every stock document rejects them.
   */
  assertTrackable(ingredient: Ingredient): void {
    if (!isTrackableIngredientType(ingredient.category.type)) {
      throw new BadRequestException(
        `Ingredient "${ingredient.name}" (type: ${ingredient.category.type}) does not support stock tracking.`,
      );
    }
  }

  /**
   * Same rule as assertTrackable, but for a category chosen up front — used
   * where an ingredient is about to be created specifically to be stocked,
   * so the caller can reject the category once instead of producing
   * ingredients that every stock document will later refuse.
   */
  async assertCategoryTrackable(ingredientCategoryId: number): Promise<void> {
    const category = await this.ingredientCategoriesService.findOne(ingredientCategoryId);
    if (!isTrackableIngredientType(category.type)) {
      throw new BadRequestException(
        `Ingredient category "${category.name}" (type: ${category.type}) does not support stock tracking.`,
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
      ...tenantFields(this.tenantContext),
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

  async moveToOutlet(id: number, dto: MoveIngredientDto): Promise<Ingredient> {
    await this.outletsService.findOne(dto.outletId);
    await this.findOne(id);

    const result = await this.ingredientsRepository.update(
      scopedWhere(this.tenantContext, { id }),
      { outletId: dto.outletId },
    );
    if (!result.affected) {
      throw new NotFoundException(`Ingredient ${id} not found`);
    }

    return this.findOne(id);
  }

  /**
   * Soft-deletes the ingredient and releases its unique identifiers.
   *
   * ingredients has plain UNIQUE constraints on code, slug and barcode that
   * don't exclude soft-deleted rows, so a deleted ingredient would otherwise
   * keep squatting on its code forever — and nothing could ever reuse it.
   * That's what stopped a food from being re-imported into inventory after
   * its ingredient was deleted. Renaming them to "<value>-deleted-<id>"
   * frees the originals while leaving the row (and its ledger history)
   * recoverable and recognisable.
   */
  async remove(id: number): Promise<void> {
    const ingredient = await this.findOne(id);
    await this.ingredientsRepository.update(id, this.releasedIdentifiersFor(ingredient));
    await this.ingredientsRepository.softDelete(id);
  }

  /**
   * Frees code/slug held by rows that were soft-deleted before remove()
   * started releasing them. Live rows are deliberately left alone: a clash
   * with one of those is a genuine conflict the caller should hear about,
   * not something to rename out from under someone.
   */
  async releaseDeletedIdentifiers(identifiers: { code?: string; slug?: string }): Promise<void> {
    const where: FindOptionsWhere<Ingredient>[] = [];
    if (identifiers.code) where.push(scopedWhere(this.tenantContext, { code: identifiers.code }));
    if (identifiers.slug) where.push(scopedWhere(this.tenantContext, { slug: identifiers.slug }));
    if (where.length === 0) return;

    const holders = await this.ingredientsRepository.find({ where, withDeleted: true });
    for (const holder of holders) {
      if (!holder.deletedAt) continue;
      await this.ingredientsRepository.update(holder.id, this.releasedIdentifiersFor(holder));
    }
  }

  private releasedIdentifiersFor(ingredient: Ingredient): Partial<Ingredient> {
    return {
      code: releasedIdentifier(ingredient.code, ingredient.id, IDENTIFIER_LENGTHS.code),
      slug: releasedIdentifier(ingredient.slug, ingredient.id, IDENTIFIER_LENGTHS.slug),
      // Null barcodes don't collide under a UNIQUE constraint, so leave them be.
      ...(ingredient.barcode
        ? { barcode: releasedIdentifier(ingredient.barcode, ingredient.id, IDENTIFIER_LENGTHS.barcode) }
        : {}),
    };
  }
}
