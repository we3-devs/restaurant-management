import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { ILike, In, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { ListOutletsQueryDto } from './dto/list-outlets-query.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { Outlet } from './entities/outlet.entity';
import { TenantContext } from '../../common/tenant/tenant-context';
import { scopedWhere } from '../../common/tenant/tenant-scope';

@Injectable()
export class OutletsService {
  constructor(
    @InjectRepository(Outlet)
    private readonly outletsRepository: Repository<Outlet>,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(
    query: ListOutletsQueryDto,
    tenantId?: number,
  ): Promise<PaginatedResponse<Outlet>> {
    const { page, limit, search } = query;
    const where = {
      ...(search ? { name: ILike(`%${search}%`) } : {}),
      ...(tenantId !== undefined ? { tenantId } : {}),
    };

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
  async findAllUnpaginated(tenantId?: number): Promise<Outlet[]> {
    return this.outletsRepository.find({
      where: tenantId !== undefined ? { tenantId } : {},
      order: { name: 'ASC' },
    });
  }

  /** Unpaginated lookup for exactly the given outlet IDs — used by GET /outlets/assigned so regular users never fetch (or need permission to view) the full outlet list. */
  async findByIds(ids: number[], tenantId?: number): Promise<Outlet[]> {
    if (ids.length === 0) return [];
    return this.outletsRepository.find({
      where: {
        id: In(ids),
        ...(tenantId !== undefined ? { tenantId } : {}),
      },
      order: { name: 'ASC' },
    });
  }

  /** Internal lookup used by OutletDepartments/Warehouses to validate an outletId. */
  async findOne(id: number): Promise<Outlet> {
    const outlet = await this.outletsRepository.findOne({ where: scopedWhere(this.tenantContext, { id }) });
    if (!outlet) {
      throw new NotFoundException(`Outlet ${id} not found`);
    }
    return outlet;
  }

  async create(dto: CreateOutletDto, tenantId: number): Promise<Outlet> {
    const slugBase = dto.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'outlet';
    const slug = `${slugBase}-${Date.now().toString(36)}`.slice(0, 80);
    const outlet = this.outletsRepository.create({
      name: dto.name,
      slug,
      tenantId,
    });
    this.applyQrOrderingFields(outlet, dto);
    this.assertQrOrderingConfigured(outlet);
    try {
      return await this.outletsRepository.save(outlet);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException('Outlet slug is already in use');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateOutletDto): Promise<Outlet> {
    const outlet = await this.findOne(id);
    if (dto.name !== undefined) {
      outlet.name = dto.name;
    }
    this.applyQrOrderingFields(outlet, dto);
    this.assertQrOrderingConfigured(outlet);

    try {
      return await this.outletsRepository.save(outlet);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException('Outlet slug is already in use');
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const outlet = await this.findOne(id);

    // Preserve historical outlet data and release the original slug for reuse.
    outlet.slug = `deleted-${randomUUID()}`;
    await this.outletsRepository.save(outlet);
  }

  private applyQrOrderingFields(
    outlet: Outlet,
    dto: CreateOutletDto | UpdateOutletDto,
  ): void {
    if (dto.qrOrderingMode !== undefined) outlet.qrOrderingMode = dto.qrOrderingMode;
    if (dto.qrAccessCheckMode !== undefined) outlet.qrAccessCheckMode = dto.qrAccessCheckMode;
    if (dto.qrAccessLatitude !== undefined) outlet.qrAccessLatitude = dto.qrAccessLatitude;
    if (dto.qrAccessLongitude !== undefined) outlet.qrAccessLongitude = dto.qrAccessLongitude;
    if (dto.qrAccessRadiusMeters !== undefined) outlet.qrAccessRadiusMeters = dto.qrAccessRadiusMeters;
    if (dto.qrAccessAllowedIp !== undefined) outlet.qrAccessAllowedIp = dto.qrAccessAllowedIp;
  }

  /**
   * Prevents an outlet being switched to quick_order without the fields its
   * configured check mode actually needs — otherwise it would silently allow
   * anonymous ordering with no real access gate at all.
   */
  private assertQrOrderingConfigured(outlet: Outlet): void {
    if (outlet.qrOrderingMode !== 'quick_order') return;

    const hasIp = !!outlet.qrAccessAllowedIp;
    const hasGeofence =
      outlet.qrAccessLatitude !== null &&
      outlet.qrAccessLongitude !== null &&
      outlet.qrAccessRadiusMeters !== null;

    const required: Record<typeof outlet.qrAccessCheckMode, boolean> = {
      ip: hasIp,
      geofence: hasGeofence,
      either: hasIp || hasGeofence,
      both: hasIp && hasGeofence,
    };

    if (!required[outlet.qrAccessCheckMode]) {
      throw new BadRequestException(
        `qrAccessCheckMode "${outlet.qrAccessCheckMode}" requires ${
          outlet.qrAccessCheckMode === 'ip'
            ? 'qrAccessAllowedIp'
            : outlet.qrAccessCheckMode === 'geofence'
              ? 'qrAccessLatitude, qrAccessLongitude and qrAccessRadiusMeters'
              : 'qrAccessAllowedIp, or all of qrAccessLatitude/qrAccessLongitude/qrAccessRadiusMeters'
        } to be set before enabling quick_order`,
      );
    }
  }
}
