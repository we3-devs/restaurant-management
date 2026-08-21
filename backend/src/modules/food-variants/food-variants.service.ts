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
  In,
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
import { FoodVariantResponseDto } from './dto/food-variant-response.dto';
import { SubVariant } from '../variants/entities/sub-variant.entity';
import { Variant } from '../variants/entities/variant.entity';
import { FoodVariantOutlet } from './entities/food-variant-outlet.entity';
import { FoodVariant } from './entities/food-variant.entity';

/** A sellable food item: this food, optionally paired with a variant and a sub-variant. */
export interface PublicFoodVariant {
  id: number;
  foodId: number;
  variantId: number | null;
  subVariantId: number | null;
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
    @InjectRepository(Variant)
    private readonly variantsListRepository: Repository<Variant>,
    @InjectRepository(SubVariant)
    private readonly subVariantsListRepository: Repository<SubVariant>,
    private readonly foodsService: FoodsService,
    private readonly outletsService: OutletsService,
    private readonly dataSource: DataSource,
    private readonly skuCompositionService: SkuCompositionService,
  ) {}

  /** Bulk name lookup for display-only consumers (e.g. order item rows) that need many variants by id without a full findAll roundtrip. */
  async findByIds(ids: number[]): Promise<FoodVariant[]> {
    if (ids.length === 0) return [];
    return this.variantsRepository.find({ where: { id: In(ids) } });
  }

  async findAll(
    query: ListFoodVariantsQueryDto,
  ): Promise<PaginatedResponse<FoodVariantResponseDto>> {
    const { page, limit, search, foodId, variantId, subVariantId } = query;
    const where: FindOptionsWhere<FoodVariant> = {};
    if (foodId !== undefined) {
      where.foodId = foodId;
    }
    if (variantId !== undefined) {
      where.variantId = variantId;
    }
    if (subVariantId !== undefined) {
      where.subVariantId = subVariantId;
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
      data: variants.map((variant) => this.toResponse(variant)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Guest-facing variant listing for /guest ordering — active variants only,
   * trimmed fields. Requires foodId (never list every variant in the system to
   * an anonymous request).
   *
   * Returns every sellable item for the food, each carrying its variantId and
   * subVariantId. The client cross-references those against the global lists
   * (/variants/public, /sub-variants/public) to render the option pickers and
   * resolve a selection back to the priced item.
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
        variantId: variant.variantId,
        subVariantId: variant.subVariantId,
        name: variant.name,
        price: variant.price,
        isDefault: variant.isDefault,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Two different unique indexes can fire here and they mean different things:
   * the combination index (this pairing is already priced) and the SKU index (a
   * code clash). Reporting both as "SKU ... already in use" produced messages
   * like `SKU "undefined" is already in use` for a duplicate pairing.
   */
  private mapUniqueViolation(error: unknown, sku?: string): unknown {
    if (
      !(error instanceof QueryFailedError) ||
      (error.driverError as { code?: string })?.code !== '23505'
    ) {
      return error;
    }

    const constraint = (error.driverError as { constraint?: string })?.constraint;
    if (constraint === 'uq_food_items_combination') {
      return new ConflictException(
        'This food already has an item for that variant and sub-variant — edit its price instead of adding a duplicate',
      );
    }
    return new ConflictException(
      sku
        ? `SKU "${sku}" is already in use`
        : 'That SKU is already in use by another item',
    );
  }

  async findOne(id: number): Promise<FoodVariant> {
    const variant = await this.variantsRepository.findOne({ where: { id } });
    if (!variant) {
      throw new NotFoundException(`Food variant ${id} not found`);
    }
    return variant;
  }

  /**
   * The variant and sub-variant must exist in the global lists. The FKs already
   * enforce that, but a 404 naming the missing list value is far more useful
   * than a raw constraint violation.
   */
  private async assertListValuesExist(
    variantId?: number | null,
    subVariantId?: number | null,
  ): Promise<void> {
    if (variantId !== undefined && variantId !== null) {
      const exists = await this.variantsListRepository.exists({
        where: { id: variantId },
      });
      if (!exists) throw new NotFoundException(`Variant ${variantId} not found`);
    }
    if (subVariantId !== undefined && subVariantId !== null) {
      const exists = await this.subVariantsListRepository.exists({
        where: { id: subVariantId },
      });
      if (!exists) {
        throw new NotFoundException(`Sub-variant ${subVariantId} not found`);
      }
    }
  }

  async create(dto: CreateFoodVariantDto): Promise<FoodVariant> {
    await this.foodsService.findOne(dto.foodId);
    await this.assertListValuesExist(dto.variantId, dto.subVariantId);

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
          variantId: dto.variantId ?? null,
          subVariantId: dto.subVariantId ?? null,
          name: dto.name,
          sku: dto.sku ?? null,
          price: dto.price ?? 0,
          isDefault: dto.isDefault ?? false,
          sortOrder: dto.sortOrder ?? 0,
        });
        return manager.save(entity);
      });

      await this.foodsService.markHasVariants(dto.foodId);
      // Recompose the whole food rather than just this row: cheap, and it
      // repairs any sibling left stale by an earlier partial edit. Always run —
      // the item's code comes entirely from the food and the two list values,
      // so a new item always needs one composed.
      await this.skuCompositionService.recomposeFoodTree(dto.foodId);
      return this.findOne(variant.id);
    } catch (error) {
      throw this.mapUniqueViolation(error, dto.sku);
    }
  }

  async update(id: number, dto: UpdateFoodVariantDto): Promise<FoodVariant> {
    const variant = await this.findOne(id);

    await this.assertListValuesExist(dto.variantId, dto.subVariantId);

    // Repointing either FK changes which combination this item represents, and
    // with it the composed SKU.
    const combinationChanged =
      (dto.variantId !== undefined && dto.variantId !== variant.variantId) ||
      (dto.subVariantId !== undefined &&
        dto.subVariantId !== variant.subVariantId);

    Object.assign(variant, {
      ...(dto.variantId !== undefined && { variantId: dto.variantId ?? null }),
      ...(dto.subVariantId !== undefined && {
        subVariantId: dto.subVariantId ?? null,
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
      throw this.mapUniqueViolation(error, dto.sku);
    }

    // Runs only after the save actually succeeded, and the row is re-read so
    // the caller sees the composed SKU rather than the stale one.
    if (combinationChanged) {
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

  toResponse(variant: FoodVariant): FoodVariantResponseDto {
    return {
      id: variant.id,
      foodId: variant.foodId,
      variantId: variant.variantId,
      subVariantId: variant.subVariantId,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      isDefault: variant.isDefault,
      isActive: variant.isActive,
      sortOrder: variant.sortOrder,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }
}
