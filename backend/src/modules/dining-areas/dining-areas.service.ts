import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { OutletsService } from '../outlets/outlets.service';
import { CreateDiningAreaDto } from './dto/create-dining-area.dto';
import { ListDiningAreasQueryDto } from './dto/list-dining-areas-query.dto';
import { UpdateDiningAreaDto } from './dto/update-dining-area.dto';
import { DiningArea } from './entities/dining-area.entity';

@Injectable()
export class DiningAreasService {
  constructor(
    @InjectRepository(DiningArea)
    private readonly diningAreasRepository: Repository<DiningArea>,
    private readonly outletsService: OutletsService,
  ) {}

  async findAll(
    query: ListDiningAreasQueryDto,
  ): Promise<PaginatedResponse<DiningArea>> {
    const { page, limit, search, outletId } = query;
    const where: FindOptionsWhere<DiningArea> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [areas, total] = await this.diningAreasRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: areas,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by DiningTablesService to validate a diningAreaId. */
  async findOne(id: number): Promise<DiningArea> {
    const area = await this.diningAreasRepository.findOne({ where: { id } });
    if (!area) {
      throw new NotFoundException(`Dining area ${id} not found`);
    }
    return area;
  }

  async create(dto: CreateDiningAreaDto): Promise<DiningArea> {
    await this.outletsService.findOne(dto.outletId);

    const area = this.diningAreasRepository.create({
      outletId: dto.outletId,
      name: dto.name,
      code: dto.code ?? null,
      description: dto.description ?? null,
      layoutWidth: dto.layoutWidth ?? 1000,
      layoutHeight: dto.layoutHeight ?? 700,
      sortOrder: dto.sortOrder ?? 100,
    });

    try {
      return await this.diningAreasRepository.save(area);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async update(id: number, dto: UpdateDiningAreaDto): Promise<DiningArea> {
    const area = await this.findOne(id);

    Object.assign(area, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.layoutWidth !== undefined && { layoutWidth: dto.layoutWidth }),
      ...(dto.layoutHeight !== undefined && {
        layoutHeight: dto.layoutHeight,
      }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      return await this.diningAreasRepository.save(area);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async remove(id: number): Promise<void> {
    const area = await this.findOne(id);
    // No deleted_at on dining_areas/dining_tables/table_sessions/order_tables
    // — this whole subsystem is hard-delete-or-status-driven by design, and
    // dining_tables.dining_area_id CASCADEs, so this is the intended path.
    await this.diningAreasRepository.remove(area);
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string })?.code === '23505'
    ) {
      return new ConflictException(
        'A dining area with this name or code already exists for this outlet',
      );
    }
    return error;
  }
}
