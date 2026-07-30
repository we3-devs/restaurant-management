import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  ILike,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { OutletDepartmentsService } from '../outlet-departments/outlet-departments.service';
import { OutletsService } from '../outlets/outlets.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Warehouse } from './entities/warehouse.entity';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehousesRepository: Repository<Warehouse>,
    private readonly outletsService: OutletsService,
    private readonly outletDepartmentsService: OutletDepartmentsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: ListWarehousesQueryDto,
  ): Promise<PaginatedResponse<Warehouse>> {
    const { page, limit, search, outletId } = query;
    const where: FindOptionsWhere<Warehouse> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [warehouses, total] = await this.warehousesRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: warehouses,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: number): Promise<Warehouse> {
    const warehouse = await this.warehousesRepository.findOne({
      where: { id },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }
    return warehouse;
  }

  async create(dto: CreateWarehouseDto): Promise<Warehouse> {
    await this.outletsService.findOne(dto.outletId);
    if (dto.outletDepartmentId !== undefined) {
      await this.assertDepartmentBelongsToOutlet(
        dto.outletDepartmentId,
        dto.outletId,
      );
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        if (dto.isDefault) {
          await manager.update(
            Warehouse,
            { outletId: dto.outletId, isDefault: true },
            { isDefault: false },
          );
        }

        const warehouse = manager.create(Warehouse, {
          outletId: dto.outletId,
          outletDepartmentId: dto.outletDepartmentId ?? null,
          name: dto.name,
          code: dto.code,
          address: dto.address ?? null,
          isDefault: dto.isDefault ?? false,
        });
        return manager.save(warehouse);
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Warehouse code "${dto.code}" is already in use`,
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateWarehouseDto): Promise<Warehouse> {
    const warehouse = await this.findOne(id);
    if (dto.outletDepartmentId !== undefined) {
      if (dto.outletDepartmentId !== null) {
        await this.assertDepartmentBelongsToOutlet(
          dto.outletDepartmentId,
          warehouse.outletId,
        );
      }
      warehouse.outletDepartmentId = dto.outletDepartmentId;
    }

    Object.assign(warehouse, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      return await this.dataSource.transaction(async (manager) => {
        if (dto.isDefault) {
          await manager.update(
            Warehouse,
            { outletId: warehouse.outletId, isDefault: true },
            { isDefault: false },
          );
          warehouse.isDefault = true;
        } else if (dto.isDefault === false) {
          warehouse.isDefault = false;
        }
        return manager.save(warehouse);
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Warehouse code "${dto.code}" is already in use`,
        );
      }
      throw error;
    }
  }

  /** Internal lookup used by OrdersService to resolve where to reserve/consume ingredient stock. */
  async findDefaultForOutlet(outletId: number): Promise<Warehouse> {
    const warehouse = await this.warehousesRepository.findOne({
      where: { outletId, isDefault: true },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `No default warehouse configured for outlet ${outletId}`,
      );
    }
    return warehouse;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    // deleted_at column present — soft delete avoids the inventory/purchasing
    // domain's RESTRICT FKs entirely (those tables have no entities yet).
    await this.warehousesRepository.softDelete(id);
  }

  private async assertDepartmentBelongsToOutlet(
    outletDepartmentId: number,
    outletId: number,
  ): Promise<void> {
    const department =
      await this.outletDepartmentsService.findOne(outletDepartmentId);
    if (department.outletId !== outletId) {
      throw new BadRequestException(
        `Outlet department ${outletDepartmentId} does not belong to outlet ${outletId}`,
      );
    }
  }
}
