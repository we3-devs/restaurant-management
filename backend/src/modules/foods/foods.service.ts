import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { AddonGroupsService } from '../addon-groups/addon-groups.service';
import { FoodCategoriesService } from '../food-categories/food-categories.service';
import { OutletsService } from '../outlets/outlets.service';
import { AssignAddonGroupDto } from './dto/assign-addon-group.dto';
import { CreateFoodDto } from './dto/create-food.dto';
import { ListFoodsQueryDto } from './dto/list-foods-query.dto';
import { UpdateFoodDto } from './dto/update-food.dto';
import { UpsertFoodOutletDto } from './dto/upsert-food-outlet.dto';
import { FoodAddonGroup } from './entities/food-addon-group.entity';
import { FoodOutlet } from './entities/food-outlet.entity';
import { Food } from './entities/food.entity';

@Injectable()
export class FoodsService {
  constructor(
    @InjectRepository(Food)
    private readonly foodsRepository: Repository<Food>,
    @InjectRepository(FoodOutlet)
    private readonly foodOutletsRepository: Repository<FoodOutlet>,
    @InjectRepository(FoodAddonGroup)
    private readonly foodAddonGroupsRepository: Repository<FoodAddonGroup>,
    private readonly foodCategoriesService: FoodCategoriesService,
    private readonly outletsService: OutletsService,
    private readonly addonGroupsService: AddonGroupsService,
  ) {}

  async findAll(query: ListFoodsQueryDto): Promise<PaginatedResponse<Food>> {
    const { page, limit, search, foodCategoryId } = query;
    const where: FindOptionsWhere<Food> = {};
    if (foodCategoryId !== undefined) {
      where.foodCategoryId = foodCategoryId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [foods, total] = await this.foodsRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: foods,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by FoodVariantsService to validate a foodId. */
  async findOne(id: number): Promise<Food> {
    const food = await this.foodsRepository.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException(`Food ${id} not found`);
    }
    return food;
  }

  async create(dto: CreateFoodDto): Promise<Food> {
    if (dto.foodCategoryId !== undefined) {
      await this.foodCategoriesService.findOne(dto.foodCategoryId);
    }

    const food = this.foodsRepository.create({
      foodCategoryId: dto.foodCategoryId ?? null,
      name: dto.name,
      slug: dto.slug,
      sku: dto.sku ?? null,
      shortDescription: dto.shortDescription ?? null,
      description: dto.description ?? null,
      foodType: dto.foodType ?? null,
      itemType: dto.itemType ?? 'food',
      basePrice: dto.basePrice ?? 0,
      isTaxable: dto.isTaxable ?? true,
      isDiscountable: dto.isDiscountable ?? true,
      isFeatured: dto.isFeatured ?? false,
      preparationTime: dto.preparationTime ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });

    try {
      return await this.foodsRepository.save(food);
    } catch (error) {
      throw this.mapUniqueViolation(error, dto.slug, dto.sku);
    }
  }

  async update(id: number, dto: UpdateFoodDto): Promise<Food> {
    const food = await this.findOne(id);

    if (dto.foodCategoryId !== undefined) {
      if (dto.foodCategoryId !== null) {
        await this.foodCategoriesService.findOne(dto.foodCategoryId);
      }
      food.foodCategoryId = dto.foodCategoryId;
    }

    Object.assign(food, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.shortDescription !== undefined && {
        shortDescription: dto.shortDescription,
      }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.foodType !== undefined && { foodType: dto.foodType }),
      ...(dto.itemType !== undefined && { itemType: dto.itemType }),
      ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
      ...(dto.isTaxable !== undefined && { isTaxable: dto.isTaxable }),
      ...(dto.isDiscountable !== undefined && {
        isDiscountable: dto.isDiscountable,
      }),
      ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      ...(dto.preparationTime !== undefined && {
        preparationTime: dto.preparationTime,
      }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      return await this.foodsRepository.save(food);
    } catch (error) {
      throw this.mapUniqueViolation(error, undefined, dto.sku);
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    // deleted_at column present — soft delete avoids the order_items.food_id
    // RESTRICT FK (no entity yet, but the real table already enforces it).
    await this.foodsRepository.softDelete(id);
  }

  async listOutletOverrides(foodId: number): Promise<FoodOutlet[]> {
    await this.findOne(foodId);
    return this.foodOutletsRepository.find({ where: { foodId } });
  }

  async upsertOutletOverride(
    foodId: number,
    dto: UpsertFoodOutletDto,
  ): Promise<FoodOutlet> {
    await this.findOne(foodId);
    await this.outletsService.findOne(dto.outletId);

    let override = await this.foodOutletsRepository.findOne({
      where: { foodId, outletId: dto.outletId },
    });

    if (!override) {
      override = this.foodOutletsRepository.create({
        foodId,
        outletId: dto.outletId,
      });
    }
    override.price = dto.price ?? null;
    override.isAvailable = dto.isAvailable ?? true;

    return this.foodOutletsRepository.save(override);
  }

  async removeOutletOverride(foodId: number, outletId: number): Promise<void> {
    await this.findOne(foodId);
    await this.foodOutletsRepository.delete({ foodId, outletId });
  }

  async listAddonGroups(foodId: number): Promise<FoodAddonGroup[]> {
    await this.findOne(foodId);
    return this.foodAddonGroupsRepository.find({
      where: { foodId },
      relations: { addonGroup: true },
    });
  }

  async assignAddonGroup(
    foodId: number,
    dto: AssignAddonGroupDto,
  ): Promise<void> {
    const food = await this.findOne(foodId);
    await this.addonGroupsService.findOne(dto.addonGroupId);

    const existing = await this.foodAddonGroupsRepository.findOne({
      where: { foodId, addonGroupId: dto.addonGroupId },
    });
    if (existing) {
      return; // idempotent
    }

    await this.foodAddonGroupsRepository.save(
      this.foodAddonGroupsRepository.create({
        foodId,
        addonGroupId: dto.addonGroupId,
      }),
    );

    if (!food.hasAddons) {
      food.hasAddons = true;
      await this.foodsRepository.save(food);
    }
  }

  async unassignAddonGroup(
    foodId: number,
    addonGroupId: number,
  ): Promise<void> {
    await this.findOne(foodId);
    await this.foodAddonGroupsRepository.delete({ foodId, addonGroupId });
  }

  /** Marks a food as having variants — called by FoodVariantsService on create. */
  async markHasVariants(foodId: number): Promise<void> {
    await this.foodsRepository.update({ id: foodId }, { hasVariants: true });
  }

  /**
   * Resolves the price to charge for this food at a given outlet, checking
   * the Phase 4 per-outlet override first and falling back to base price.
   * Used by OrdersService to snapshot order_items.unit_price at add-time.
   */
  async resolvePriceForOutlet(
    foodId: number,
    outletId: number,
  ): Promise<{ food: Food; price: number }> {
    const food = await this.findOne(foodId);
    const override = await this.foodOutletsRepository.findOne({
      where: { foodId, outletId },
    });

    if (override && !override.isAvailable) {
      throw new BadRequestException(
        `Food ${foodId} is not available at outlet ${outletId}`,
      );
    }

    return { food, price: override?.price ?? food.basePrice };
  }

  private mapUniqueViolation(
    error: unknown,
    slug?: string,
    sku?: string,
  ): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string; detail?: string })?.code ===
        '23505'
    ) {
      const detail = (error.driverError as { detail?: string })?.detail ?? '';
      if (detail.includes('sku')) {
        return new ConflictException(`SKU "${sku}" is already in use`);
      }
      return new ConflictException(`Slug "${slug}" is already in use`);
    }
    return error;
  }
}
