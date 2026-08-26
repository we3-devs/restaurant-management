import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { CreateIngredientCategoryDto } from './dto/create-ingredient-category.dto';
import { ListIngredientCategoriesQueryDto } from './dto/list-ingredient-categories-query.dto';
import { UpdateIngredientCategoryDto } from './dto/update-ingredient-category.dto';
import { IngredientCategory } from './entities/ingredient-category.entity';

@Injectable()
export class IngredientCategoriesService {
  constructor(
    @InjectRepository(IngredientCategory)
    private readonly categoriesRepository: Repository<IngredientCategory>,
  ) {}

  async findAll(
    query: ListIngredientCategoriesQueryDto,
  ): Promise<PaginatedResponse<IngredientCategory>> {
    const { page, limit, search, parentId } = query;
    const where: FindOptionsWhere<IngredientCategory> = {};
    if (parentId !== undefined) {
      where.parentId = parentId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [categories, total] = await this.categoriesRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: categories,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by IngredientsService to validate an ingredientCategoryId. */
  async findOne(id: number): Promise<IngredientCategory> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Ingredient category ${id} not found`);
    }
    return category;
  }

  async create(dto: CreateIngredientCategoryDto): Promise<IngredientCategory> {
    if (dto.parentId !== undefined) {
      await this.findOne(dto.parentId);
    }

    const category = this.categoriesRepository.create({
      parentId: dto.parentId ?? null,
      name: dto.name,
      slug: dto.slug,
      code: dto.code ?? null,
      type: dto.type,
    });

    try {
      return await this.categoriesRepository.save(category);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Category slug "${dto.slug}" or code "${dto.code}" is already in use`,
        );
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateIngredientCategoryDto,
  ): Promise<IngredientCategory> {
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
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      return await this.categoriesRepository.save(category);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Category code "${dto.code}" is already in use`,
        );
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.categoriesRepository.softDelete(id);
  }
}
