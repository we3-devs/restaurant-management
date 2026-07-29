import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { AddonGroupsService } from '../addon-groups/addon-groups.service';
import { Addon } from './entities/addon.entity';
import { CreateAddonDto } from './dto/create-addon.dto';
import { ListAddonsQueryDto } from './dto/list-addons-query.dto';
import { UpdateAddonDto } from './dto/update-addon.dto';

@Injectable()
export class AddonsService {
  constructor(
    @InjectRepository(Addon)
    private readonly addonsRepository: Repository<Addon>,
    private readonly addonGroupsService: AddonGroupsService,
  ) {}

  async findAll(query: ListAddonsQueryDto): Promise<PaginatedResponse<Addon>> {
    const { page, limit, search, addonGroupId } = query;
    const where: FindOptionsWhere<Addon> = {};
    if (addonGroupId !== undefined) {
      where.addonGroupId = addonGroupId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [addons, total] = await this.addonsRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: addons,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: number): Promise<Addon> {
    const addon = await this.addonsRepository.findOne({ where: { id } });
    if (!addon) {
      throw new NotFoundException(`Addon ${id} not found`);
    }
    return addon;
  }

  async create(dto: CreateAddonDto): Promise<Addon> {
    if (dto.addonGroupId !== undefined) {
      await this.addonGroupsService.findOne(dto.addonGroupId);
    }

    const addon = this.addonsRepository.create({
      addonGroupId: dto.addonGroupId ?? null,
      name: dto.name,
      price: dto.price ?? 0,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.addonsRepository.save(addon);
  }

  async update(id: number, dto: UpdateAddonDto): Promise<Addon> {
    const addon = await this.findOne(id);

    if (dto.addonGroupId !== undefined) {
      if (dto.addonGroupId !== null) {
        await this.addonGroupsService.findOne(dto.addonGroupId);
      }
      addon.addonGroupId = dto.addonGroupId;
    }

    Object.assign(addon, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    return this.addonsRepository.save(addon);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    // deleted_at column present — soft delete avoids the order_item_addons
    // RESTRICT FK (no entity yet, but the real table already enforces it).
    await this.addonsRepository.softDelete(id);
  }
}
