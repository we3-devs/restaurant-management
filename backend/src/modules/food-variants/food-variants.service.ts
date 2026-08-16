import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  ILike,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { FoodsService } from '../foods/foods.service';
import { SkuCompositionService } from '../foods/sku-composition.service';
import { normaliseSkuSegment } from '../../common/sku.util';
import { OutletsService } from '../outlets/outlets.service';
import { CreateFoodVariantDto } from './dto/create-food-variant.dto';
import { ListFoodVariantsQueryDto } from './dto/list-food-variants-query.dto';
import { UpdateFoodVariantDto } from './dto/update-food-variant.dto';
import { UpsertFoodVariantOutletDto } from './dto/upsert-food-variant-outlet.dto';
import { FoodVariantOutlet } from './entities/food-variant-outlet.entity';
import { FoodVariant } from './entities/food-variant.entity';

export interface PublicFoodVariant {
  id: number;
  foodId: number;
  /** NULL for a top-level variant; otherwise the group this one sits under. */
  parentId: number | null;
  name: string;
  price: number;
  isDefault: boolean;
}

@Injectable()
export class FoodVariantsService {
  constructor(
    @InjectRepository(FoodVariant)
    private readonly variantsRepository: Repository<FoodVariant>,
    @InjectRepository(FoodVariantOutlet)
    private readonly variantOutletsRepository: Repository<FoodVariantOutlet>,
    private readonly foodsService: FoodsService,
    private readonly outletsService: OutletsService,
    private readonly dataSource: DataSource,
    private readonly skuCompositionService: SkuCompositionService,
  ) {}

  async findAll(
    query: ListFoodVariantsQueryDto,
  ): Promise<PaginatedResponse<FoodVariant>> {
    const { page, limit, search, foodId, parentId } = query;
    const where: FindOptionsWhere<FoodVariant> = {};
    if (foodId !== undefined) {
      where.foodId = foodId;
    }
    if (parentId !== undefined) {
      where.parentId = parentId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [variants, total] = await this.variantsRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: variants,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Guest-facing variant listing for /guest ordering — active variants only,
   * trimmed fields. Requires foodId (never list every variant in the system to
   * an anonymous request).
   *
   * Returns the food's whole variant tree flat, both levels, with parentId on
   * each row: one request per food, and the client assembles the hierarchy.
   * Paginating a tree would risk splitting children away from their parent.
   */
  async findAllPublic(
    query: ListFoodVariantsQueryDto,
  ): Promise<PaginatedResponse<PublicFoodVariant>> {
    const { page, limit, foodId } = query;
    if (foodId === undefined) {
      throw new BadRequestException('foodId is required');
    }

    const [variants, total] = await this.variantsRepository.findAndCount({
      where: { foodId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: variants.map((variant) => ({
        id: variant.id,
        foodId: variant.foodId,
        parentId: variant.parentId,
        name: variant.name,
        price: variant.price,
        isDefault: variant.isDefault,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: number): Promise<FoodVariant> {
    const variant = await this.variantsRepository.findOne({ where: { id } });
    if (!variant) {
      throw new NotFoundException(`Food variant ${id} not found`);
    }
    return variant;
  }

  /**
   * A parent must belong to the same food and must itself be top-level. The FK
   * alone would happily allow a variant of one dish to parent a variant of
   * another, or a three-deep chain that no part of the UI can render.
   */
  private async assertValidParent(
    parentId: number,
    foodId: number,
    selfId?: number,
  ): Promise<void> {
    if (selfId !== undefined && parentId === selfId) {
      throw new BadRequestException('A variant cannot be its own parent');
    }

    const parent = await this.variantsRepository.findOne({
      where: { id: parentId },
    });
    if (!parent) {
      throw new NotFoundException(`Food variant ${parentId} not found`);
    }
    if (parent.foodId !== foodId) {
      throw new BadRequestException(
        `Parent variant ${parentId} belongs to a different food`,
      );
    }
    if (parent.parentId !== null) {
      throw new BadRequestException(
        'Variants can only nest one level deep (e.g. Veg -> Half), so the parent must be a top-level variant',
      );
    }
  }

  async create(dto: CreateFoodVariantDto): Promise<FoodVariant> {
    await this.foodsService.findOne(dto.foodId);
    if (dto.parentId !== undefined && dto.parentId !== null) {
      await this.assertValidParent(dto.parentId, dto.foodId);
    }

    try {
      const variant = await this.dataSource.transaction(async (manager) => {
        if (dto.isDefault) {
          await manager.update(
            FoodVariant,
            { foodId: dto.foodId, isDefault: true },
            { isDefault: false },
          );
        }

        const entity = manager.create(FoodVariant, {
          foodId: dto.foodId,
          parentId: dto.parentId ?? null,
          name: dto.name,
          sku: dto.sku ?? null,
          skuSegment: dto.skuSegment
            ? normaliseSkuSegment(dto.skuSegment)
            : null,
          price: dto.price ?? 0,
          isDefault: dto.isDefault ?? false,
          sortOrder: dto.sortOrder ?? 0,
        });
        return manager.save(entity);
      });

      await this.foodsService.markHasVariants(dto.foodId);
      if (variant.skuSegment) {
        // Recompose the whole food rather than just this row: cheap, and it
        // repairs any sibling left stale by an earlier partial edit.
        await this.skuCompositionService.recomposeFoodTree(dto.foodId);
        return this.findOne(variant.id);
      }
      return variant;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(`SKU "${dto.sku}" is already in use`);
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateFoodVariantDto): Promise<FoodVariant> {
    const variant = await this.findOne(id);

    if (dto.parentId !== undefined) {
      if (dto.parentId === null) {
        variant.parentId = null;
      } else {
        await this.assertValidParent(dto.parentId, variant.foodId, id);
        // Nesting a variant that already has children would make the tree
        // three deep, which assertValidParent can't see from the parent side.
        const childCount = await this.variantsRepository.count({
          where: { parentId: id },
        });
        if (childCount > 0) {
          throw new BadRequestException(
            `Variant ${id} has ${childCount} sub-variant(s), so it cannot itself be nested under another`,
          );
        }
        variant.parentId = dto.parentId;
      }
    }

    const previousSegment = variant.skuSegment;

    Object.assign(variant, {
      ...(dto.skuSegment !== undefined && {
        skuSegment: dto.skuSegment ? normaliseSkuSegment(dto.skuSegment) : null,
      }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    let saved: FoodVariant;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        if (dto.isDefault) {
          await manager.update(
            FoodVariant,
            { foodId: variant.foodId, isDefault: true },
            { isDefault: false },
          );
          variant.isDefault = true;
        } else if (dto.isDefault === false) {
          variant.isDefault = false;
        }
        return manager.save(variant);
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(`SKU "${dto.sku}" is already in use`);
      }
      throw error;
    }

    // A changed segment moves this row's code and, if it's a parent, every
    // child's too. Runs only after the save actually succeeded, and the row is
    // re-read so the caller sees the composed SKU rather than the stale one.
    if (saved.skuSegment && saved.skuSegment !== previousSegment) {
      await this.skuCompositionService.recomposeFoodTree(saved.foodId);
      return this.findOne(saved.id);
    }
    return saved;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    // deleted_at column present — soft delete avoids the order_items
    // food_variant_id SET NULL FK (no entity yet, but the real table already
    // has it) leaving historical order lines silently un-attributable.
    await this.variantsRepository.softDelete(id);
  }

  async listOutletOverrides(variantId: number): Promise<FoodVariantOutlet[]> {
    await this.findOne(variantId);
    return this.variantOutletsRepository.find({
      where: { foodVariantId: variantId },
    });
  }

  async upsertOutletOverride(
    variantId: number,
    dto: UpsertFoodVariantOutletDto,
  ): Promise<FoodVariantOutlet> {
    await this.findOne(variantId);
    await this.outletsService.findOne(dto.outletId);

    let override = await this.variantOutletsRepository.findOne({
      where: { foodVariantId: variantId, outletId: dto.outletId },
    });

    if (!override) {
      override = this.variantOutletsRepository.create({
        foodVariantId: variantId,
        outletId: dto.outletId,
      });
    }
    override.price = dto.price ?? null;
    override.isAvailable = dto.isAvailable ?? true;

    return this.variantOutletsRepository.save(override);
  }

  async removeOutletOverride(
    variantId: number,
    outletId: number,
  ): Promise<void> {
    await this.findOne(variantId);
    await this.variantOutletsRepository.delete({
      foodVariantId: variantId,
      outletId,
    });
  }

  /**
   * Resolves the price to charge for this variant at a given outlet,
   * checking the Phase 4 per-outlet override first and falling back to the
   * variant's own price. Used by OrdersService to snapshot
   * order_items.unit_price at add-time.
   */
  async resolvePriceForOutlet(
    variantId: number,
    outletId: number,
  ): Promise<{ variant: FoodVariant; price: number }> {
    const variant = await this.findOne(variantId);
    const override = await this.variantOutletsRepository.findOne({
      where: { foodVariantId: variantId, outletId },
    });

    if (override && !override.isAvailable) {
      throw new BadRequestException(
        `Food variant ${variantId} is not available at outlet ${outletId}`,
      );
    }

    return { variant, price: override?.price ?? variant.price };
  }
}
