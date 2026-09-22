import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { TenantContext } from '../../common/tenant/tenant-context';
import { scopedWhere, tenantFields } from '../../common/tenant/tenant-scope';
import { CreateInventoryKitDto } from './dto/create-inventory-kit.dto';
import { CreateKitItemDto } from './dto/create-kit-item.dto';
import { CreateKitPortionDto } from './dto/create-kit-portion.dto';
import { ListInventoryKitsQueryDto } from './dto/list-inventory-kits-query.dto';
import { UpdateInventoryKitDto } from './dto/update-inventory-kit.dto';
import { InventoryKitItem } from './entities/inventory-kit-item.entity';
import { InventoryKitPortion } from './entities/inventory-kit-portion.entity';
import { InventoryKit } from './entities/inventory-kit.entity';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class InventoryKitsService {
  constructor(
    @InjectRepository(InventoryKit)
    private readonly kitsRepository: Repository<InventoryKit>,
    @InjectRepository(InventoryKitItem)
    private readonly kitItemsRepository: Repository<InventoryKitItem>,
    @InjectRepository(InventoryKitPortion)
    private readonly kitPortionsRepository: Repository<InventoryKitPortion>,
    private readonly tenantContext: TenantContext,
  ) {}

  // ------------------------------------------------------------------ kits

  async findAll(query: ListInventoryKitsQueryDto): Promise<PaginatedResponse<InventoryKit>> {
    const { page, limit, search } = query;
    let where: FindOptionsWhere<InventoryKit> = {};
    if (search) {
      where.name = ILike(`%${search}%`);
    }
    where = scopedWhere(this.tenantContext, where);

    const [kits, total] = await this.kitsRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: kits,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: number): Promise<InventoryKit> {
    const kit = await this.kitsRepository.findOne({ where: scopedWhere(this.tenantContext, { id }) });
    if (!kit) {
      throw new NotFoundException(`Inventory kit ${id} not found`);
    }
    return kit;
  }

  async create(dto: CreateInventoryKitDto): Promise<InventoryKit> {
    const kit = this.kitsRepository.create({
      name: dto.name,
      slug: slugify(dto.name),
      description: dto.description ?? null,
      ...tenantFields(this.tenantContext),
    });

    try {
      return await this.kitsRepository.save(kit);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(`An inventory kit named "${dto.name}" already exists`);
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateInventoryKitDto): Promise<InventoryKit> {
    const kit = await this.findOne(id);

    Object.assign(kit, {
      ...(dto.name !== undefined && { name: dto.name, slug: slugify(dto.name) }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      return await this.kitsRepository.save(kit);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(`An inventory kit named "${kit.name}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.kitsRepository.softDelete(id);
  }

  // ------------------------------------------------------------------- items

  async listItems(kitId: number): Promise<InventoryKitItem[]> {
    await this.findOne(kitId);
    return this.kitItemsRepository.find({
      where: scopedWhere(this.tenantContext, { kitId }),
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  async addItem(kitId: number, dto: CreateKitItemDto): Promise<InventoryKitItem> {
    await this.findOne(kitId);

    const item = this.kitItemsRepository.create({
      kitId,
      ingredientId: dto.ingredientId,
      label: dto.label,
      unitId: dto.unitId,
      sortOrder: dto.sortOrder ?? 0,
      ...tenantFields(this.tenantContext),
    });

    try {
      return await this.kitItemsRepository.save(item);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException('This ingredient is already a variance of this kit');
      }
      throw error;
    }
  }

  async removeItem(kitId: number, itemId: number): Promise<void> {
    const item = await this.kitItemsRepository.findOne({
      where: scopedWhere(this.tenantContext, { id: itemId, kitId }),
    });
    if (!item) {
      throw new NotFoundException(`Kit item ${itemId} not found`);
    }
    await this.kitPortionsRepository.delete(
      scopedWhere<InventoryKitPortion>(this.tenantContext, { kitItemId: itemId }),
    );
    await this.kitItemsRepository.delete(item.id);
  }

  // --------------------------------------------------------------- portions

  private async findItemOrThrow(kitId: number, itemId: number): Promise<InventoryKitItem> {
    const item = await this.kitItemsRepository.findOne({
      where: scopedWhere(this.tenantContext, { id: itemId, kitId }),
    });
    if (!item) {
      throw new NotFoundException(`Kit item ${itemId} not found`);
    }
    return item;
  }

  async listPortions(kitId: number, itemId: number): Promise<InventoryKitPortion[]> {
    await this.findItemOrThrow(kitId, itemId);
    return this.kitPortionsRepository.find({
      where: scopedWhere(this.tenantContext, { kitItemId: itemId }),
      order: { name: 'ASC' },
    });
  }

  async addPortion(
    kitId: number,
    itemId: number,
    dto: CreateKitPortionDto,
  ): Promise<InventoryKitPortion> {
    await this.findItemOrThrow(kitId, itemId);

    const portion = this.kitPortionsRepository.create({
      kitItemId: itemId,
      name: dto.name,
      unitId: dto.unitId,
      quantity: dto.quantity,
      ...tenantFields(this.tenantContext),
    });

    return this.kitPortionsRepository.save(portion);
  }

  async removePortion(kitId: number, itemId: number, portionId: number): Promise<void> {
    await this.findItemOrThrow(kitId, itemId);
    const portion = await this.kitPortionsRepository.findOne({
      where: scopedWhere(this.tenantContext, { id: portionId, kitItemId: itemId }),
    });
    if (!portion) {
      throw new NotFoundException(`Kit portion ${portionId} not found`);
    }
    await this.kitPortionsRepository.delete(portion.id);
  }
}
