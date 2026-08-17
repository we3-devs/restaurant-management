import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normaliseSkuSegment } from '../../common/sku.util';
import { FoodVariant } from '../food-variants/entities/food-variant.entity';
import { SkuCompositionService } from '../foods/sku-composition.service';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';
import { SubVariant } from './entities/sub-variant.entity';
import { Variant } from './entities/variant.entity';

/**
 * The two global option lists. Both have an identical shape and identical
 * rules, so one service drives both via a repository picked per call rather
 * than two near-duplicate classes.
 */
@Injectable()
export class VariantsService {
  constructor(
    @InjectRepository(Variant)
    private readonly variantsRepository: Repository<Variant>,
    @InjectRepository(SubVariant)
    private readonly subVariantsRepository: Repository<SubVariant>,
    @InjectRepository(FoodVariant)
    private readonly foodItemsRepository: Repository<FoodVariant>,
    private readonly skuCompositionService: SkuCompositionService,
  ) {}

  private repo(kind: 'variant' | 'sub-variant') {
    return kind === 'variant'
      ? (this.variantsRepository as Repository<Variant | SubVariant>)
      : (this.subVariantsRepository as Repository<Variant | SubVariant>);
  }

  findAll(kind: 'variant' | 'sub-variant') {
    return this.repo(kind).find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async findOne(kind: 'variant' | 'sub-variant', id: number) {
    const row = await this.repo(kind).findOne({ where: { id } });
    if (!row) throw new NotFoundException(`${kind} ${id} not found`);
    return row;
  }

  async create(kind: 'variant' | 'sub-variant', dto: CreateVariantDto) {
    const repo = this.repo(kind);
    try {
      return await repo.save(
        repo.create({
          name: dto.name.trim(),
          skuSegment: dto.skuSegment
            ? normaliseSkuSegment(dto.skuSegment)
            : null,
          sortOrder: dto.sortOrder ?? 0,
        }),
      );
    } catch (error) {
      // Unique on lower(name) — the list exists so a value is defined once.
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(`"${dto.name}" already exists`);
      }
      throw error;
    }
  }

  async update(
    kind: 'variant' | 'sub-variant',
    id: number,
    dto: UpdateVariantDto,
  ) {
    const row = await this.findOne(kind, id);
    Object.assign(row, {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.skuSegment !== undefined && {
        skuSegment: dto.skuSegment ? normaliseSkuSegment(dto.skuSegment) : null,
      }),
    });
    let saved: Variant | SubVariant;
    try {
      saved = await this.repo(kind).save(row);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(`"${dto.name}" already exists`);
      }
      throw error;
    }

    // Codes derive from this value's name (or its segment), so a rename here has
    // to rewrite the SKU of every food item using it — across all foods, not one.
    await this.skuCompositionService.recomposeForListValue(kind, saved.id);
    return saved;
  }

  /**
   * Refuses while food items still reference it. The FK is ON DELETE RESTRICT
   * so the database would block this anyway — this turns that into a message
   * that says how many items are in the way.
   */
  async remove(kind: 'variant' | 'sub-variant', id: number) {
    const row = await this.findOne(kind, id);
    const inUse = await this.foodItemsRepository.count({
      where:
        kind === 'variant' ? { variantId: id } : { subVariantId: id },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `${inUse} food item(s) still use "${row.name}" — remove or repoint them first`,
      );
    }
    await this.repo(kind).remove(row);
  }
}
