import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { ListOutletsQueryDto } from './dto/list-outlets-query.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { Outlet } from './entities/outlet.entity';

@Injectable()
export class OutletsService {
  constructor(
    @InjectRepository(Outlet)
    private readonly outletsRepository: Repository<Outlet>,
  ) {}

  async findAll(
    query: ListOutletsQueryDto,
  ): Promise<PaginatedResponse<Outlet>> {
    const { page, limit, search } = query;
    const where = search ? { name: ILike(`%${search}%`) } : {};

    // Two independent round trips (rows + count) — run concurrently instead
    // of TypeORM's findAndCount(), which issues them one after another.
    const [outlets, total] = await Promise.all([
      this.outletsRepository.find({
        where,
        order: { name: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.outletsRepository.count({ where }),
    ]);

    return {
      data: outlets,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Every outlet, unpaginated — used by GET /outlets/assigned for superadmins and users with only global/unscoped assignments. */
  async findAllUnpaginated(): Promise<Outlet[]> {
    return this.outletsRepository.find({ order: { name: 'ASC' } });
  }

  /** Unpaginated lookup for exactly the given outlet IDs — used by GET /outlets/assigned so regular users never fetch (or need permission to view) the full outlet list. */
  async findByIds(ids: number[]): Promise<Outlet[]> {
    if (ids.length === 0) return [];
    return this.outletsRepository.find({
      where: { id: In(ids) },
      order: { name: 'ASC' },
    });
  }

  /** Internal lookup used by OutletDepartments/Warehouses to validate an outletId. */
  async findOne(id: number): Promise<Outlet> {
    const outlet = await this.outletsRepository.findOne({ where: { id } });
    if (!outlet) {
      throw new NotFoundException(`Outlet ${id} not found`);
    }
    return outlet;
  }

  async create(dto: CreateOutletDto): Promise<Outlet> {
    const outlet = this.outletsRepository.create({ name: dto.name });
    try {
      return await this.outletsRepository.save(outlet);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Outlet name "${dto.name}" is already in use`,
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateOutletDto): Promise<Outlet> {
    const outlet = await this.findOne(id);
    if (dto.name !== undefined) {
      outlet.name = dto.name;
    }

    try {
      return await this.outletsRepository.save(outlet);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Outlet name "${dto.name}" is already in use`,
        );
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const outlet = await this.findOne(id);
    try {
      await this.outletsRepository.remove(outlet);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23503'
      ) {
        throw new ConflictException(
          `Cannot delete outlet ${id}: other records (departments, warehouses, orders, etc.) still reference it`,
        );
      }
      throw error;
    }
  }
}
