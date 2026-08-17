import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { DiningAreasService } from '../dining-areas/dining-areas.service';
import { OutletsService } from '../outlets/outlets.service';
import { CreateDiningTableDto } from './dto/create-dining-table.dto';
import { ListDiningTablesQueryDto } from './dto/list-dining-tables-query.dto';
import { UpdateDiningTableDto } from './dto/update-dining-table.dto';
import { DiningTable, DiningTableStatus } from './entities/dining-table.entity';

@Injectable()
export class DiningTablesService {
  constructor(
    @InjectRepository(DiningTable)
    private readonly diningTablesRepository: Repository<DiningTable>,
    private readonly diningAreasService: DiningAreasService,
    private readonly outletsService: OutletsService,
  ) {}

  async findAll(
    query: ListDiningTablesQueryDto,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<PaginatedResponse<DiningTable>> {
    const { page, limit, search, outletId, diningAreaId, status } = query;
    const where: FindOptionsWhere<DiningTable> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    } else if (accessibleOutletIds !== 'ALL') {
      where.outletId = In(accessibleOutletIds);
    }
    if (diningAreaId !== undefined) {
      where.diningAreaId = diningAreaId;
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [tables, total] = await this.diningTablesRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: tables,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by TableSessionsService/OrdersService to validate a diningTableId. */
  async findOne(id: number): Promise<DiningTable> {
    const table = await this.diningTablesRepository.findOne({
      where: { id },
    });
    if (!table) {
      throw new NotFoundException(`Dining table ${id} not found`);
    }
    return table;
  }

  /** Public lookup by the table's human-readable code, used by the guest QR service page. */
  async findByCode(code: string): Promise<DiningTable> {
    const table = await this.diningTablesRepository.findOne({
      where: { code },
    });
    if (!table) {
      throw new NotFoundException(`No dining table with code "${code}"`);
    }
    return table;
  }

  async create(dto: CreateDiningTableDto): Promise<DiningTable> {
    await this.outletsService.findOne(dto.outletId);
    await this.assertAreaBelongsToOutlet(dto.diningAreaId, dto.outletId);

    const table = this.diningTablesRepository.create({
      outletId: dto.outletId,
      diningAreaId: dto.diningAreaId,
      name: dto.name,
      code: dto.code ?? null,
      capacity: dto.capacity ?? 1,
      shape: dto.shape ?? 'rectangle',
      positionX: dto.positionX ?? 0,
      positionY: dto.positionY ?? 0,
      sortOrder: dto.sortOrder ?? 100,
    });

    try {
      return await this.diningTablesRepository.save(table);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async update(id: number, dto: UpdateDiningTableDto): Promise<DiningTable> {
    const table = await this.findOne(id);

    Object.assign(table, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.capacity !== undefined && { capacity: dto.capacity }),
      ...(dto.shape !== undefined && { shape: dto.shape }),
      ...(dto.positionX !== undefined && { positionX: dto.positionX }),
      ...(dto.positionY !== undefined && { positionY: dto.positionY }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      return await this.diningTablesRepository.save(table);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async remove(id: number): Promise<void> {
    const table = await this.findOne(id);
    // No deleted_at — hard-delete-or-status-driven by design (see DiningAreasService).
    await this.diningTablesRepository.remove(table);
  }

  /** Used by TableSessionsService to flip table status without a full DTO round-trip. */
  async setStatus(id: number, status: DiningTableStatus): Promise<void> {
    await this.diningTablesRepository.update({ id }, { status });
  }

  private async assertAreaBelongsToOutlet(
    diningAreaId: number,
    outletId: number,
  ): Promise<void> {
    const area = await this.diningAreasService.findOne(diningAreaId);
    if (area.outletId !== outletId) {
      throw new BadRequestException(
        `Dining area ${diningAreaId} does not belong to outlet ${outletId}`,
      );
    }
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string })?.code === '23505'
    ) {
      return new ConflictException(
        'A dining table with this name or code already exists in this area',
      );
    }
    return error;
  }
}
