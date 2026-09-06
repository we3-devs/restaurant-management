import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { OutletsService } from '../outlets/outlets.service';
import { CreateOutletDepartmentDto } from './dto/create-outlet-department.dto';
import { ListOutletDepartmentsQueryDto } from './dto/list-outlet-departments-query.dto';
import { UpdateOutletDepartmentDto } from './dto/update-outlet-department.dto';
import { OutletDepartment } from './entities/outlet-department.entity';

@Injectable()
export class OutletDepartmentsService {
  constructor(
    @InjectRepository(OutletDepartment)
    private readonly departmentsRepository: Repository<OutletDepartment>,
    private readonly outletsService: OutletsService,
  ) {}

  async findAll(
    query: ListOutletDepartmentsQueryDto,
  ): Promise<PaginatedResponse<OutletDepartment>> {
    const { page, limit, search, outletId } = query;
    const where: FindOptionsWhere<OutletDepartment> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [departments, total] = await this.departmentsRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: departments,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Unpaginated, single-outlet lookup used by GET /outlet-departments/assigned — no `outlet-departments.view` permission required to see the departments at your own outlet. */
  async findByOutlet(outletId: number): Promise<OutletDepartment[]> {
    return this.departmentsRepository.find({
      where: { outletId },
      order: { name: 'ASC' },
    });
  }

  /** Internal lookup used by WarehousesService to validate an outletDepartmentId. */
  async findOne(id: number): Promise<OutletDepartment> {
    const department = await this.departmentsRepository.findOne({
      where: { id },
    });
    if (!department) {
      throw new NotFoundException(`Outlet department ${id} not found`);
    }
    return department;
  }

  async create(dto: CreateOutletDepartmentDto): Promise<OutletDepartment> {
    await this.outletsService.findOne(dto.outletId);

    const department = this.departmentsRepository.create({
      outletId: dto.outletId,
      name: dto.name,
      code: dto.code ?? null,
      type: dto.type ?? 'other',
      description: dto.description ?? null,
      canPrepareOrder: dto.canPrepareOrder ?? false,
    });

    try {
      return await this.departmentsRepository.save(department);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Department code "${dto.code}" is already in use for this outlet`,
        );
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateOutletDepartmentDto,
  ): Promise<OutletDepartment> {
    const department = await this.findOne(id);

    Object.assign(department, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.canPrepareOrder !== undefined && {
        canPrepareOrder: dto.canPrepareOrder,
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      return await this.departmentsRepository.save(department);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Department code "${dto.code}" is already in use for this outlet`,
        );
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    // deleted_at column present — soft delete avoids the order_items
    // preparation_department_id RESTRICT FK entirely.
    await this.departmentsRepository.softDelete(id);
  }
}
