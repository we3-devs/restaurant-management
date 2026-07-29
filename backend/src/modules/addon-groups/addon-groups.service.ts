import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { AddonGroup } from './entities/addon-group.entity';
import { CreateAddonGroupDto } from './dto/create-addon-group.dto';
import { ListAddonGroupsQueryDto } from './dto/list-addon-groups-query.dto';
import { UpdateAddonGroupDto } from './dto/update-addon-group.dto';

@Injectable()
export class AddonGroupsService {
  constructor(
    @InjectRepository(AddonGroup)
    private readonly addonGroupsRepository: Repository<AddonGroup>,
  ) {}

  async findAll(
    query: ListAddonGroupsQueryDto,
  ): Promise<PaginatedResponse<AddonGroup>> {
    const { page, limit, search } = query;
    const [addonGroups, total] = await this.addonGroupsRepository.findAndCount({
      where: search ? { name: ILike(`%${search}%`) } : {},
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: addonGroups,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by AddonsService/FoodsService to validate an addonGroupId. */
  async findOne(id: number): Promise<AddonGroup> {
    const addonGroup = await this.addonGroupsRepository.findOne({
      where: { id },
    });
    if (!addonGroup) {
      throw new NotFoundException(`Addon group ${id} not found`);
    }
    return addonGroup;
  }

  async create(dto: CreateAddonGroupDto): Promise<AddonGroup> {
    const addonGroup = this.addonGroupsRepository.create({
      name: dto.name,
      isRequired: dto.isRequired ?? false,
      minSelect: dto.minSelect ?? 0,
      maxSelect: dto.maxSelect ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.addonGroupsRepository.save(addonGroup);
  }

  async update(id: number, dto: UpdateAddonGroupDto): Promise<AddonGroup> {
    const addonGroup = await this.findOne(id);

    Object.assign(addonGroup, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
      ...(dto.minSelect !== undefined && { minSelect: dto.minSelect }),
      ...(dto.maxSelect !== undefined && { maxSelect: dto.maxSelect }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    return this.addonGroupsRepository.save(addonGroup);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.addonGroupsRepository.softDelete(id);
  }
}
