import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { CreateFoodCategoryDto } from './dto/create-food-category.dto';
import { ListFoodCategoriesQueryDto } from './dto/list-food-categories-query.dto';
import { UpdateFoodCategoryDto } from './dto/update-food-category.dto';
import { FoodCategory } from './entities/food-category.entity';

@Injectable()
export class FoodCategoriesService {
  constructor(
    @InjectRepository(FoodCategory)
    private readonly categoriesRepository: Repository<FoodCategory>,
  ) {}

  async findAll(
    query: ListFoodCategoriesQueryDto,
  ): Promise<PaginatedResponse<FoodCategory>> {
    const { page, limit, search, parentId } = query;
    const where: FindOptionsWhere<FoodCategory> = {};
    if (parentId !== undefined) {
      where.parentId = parentId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [categories, total] = await this.categoriesRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: categories,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by FoodsService to validate a foodCategoryId. */
  async findOne(id: number): Promise<FoodCategory> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Food category ${id} not found`);
    }
    return category;
  }

  async create(dto: CreateFoodCategoryDto): Promise<FoodCategory> {
    if (dto.parentId !== undefined) {
      await this.findOne(dto.parentId);
    }

    const category = this.categoriesRepository.create({
      parentId: dto.parentId ?? null,
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      image: dto.image ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });

    try {
      return await this.categoriesRepository.save(category);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Category slug "${dto.slug}" is already in use`,
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateFoodCategoryDto): Promise<FoodCategory> {
    const category = await this.findOne(id);

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      if (dto.parentId !== null) {
        await this.findOne(dto.parentId);
      }
      category.parentId = dto.parentId;
    }

    Object.assign(category, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.image !== undefined && { image: dto.image }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    return this.categoriesRepository.save(category);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    // deleted_at column present — soft delete, matching the Departments/
    // Warehouses precedent, even though the food_categories FK is SET NULL
    // (hard delete would be safe FK-wise but would lose the category record).
    await this.categoriesRepository.softDelete(id);
  }
}
