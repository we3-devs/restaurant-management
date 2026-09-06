import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Outlet } from '../outlets/entities/outlet.entity';
import { CreateTenantDto, UpdateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(Outlet) private readonly outlets: Repository<Outlet>,
  ) {}

  list() {
    return this.tenants.find({ relations: { outlets: true }, order: { name: 'ASC' } });
  }

  allOutlets() {
    return this.outlets.find({ relations: { tenant: true }, order: { name: 'ASC' } });
  }

  async create(dto: CreateTenantDto) {
    try { return await this.tenants.save(this.tenants.create(dto)); }
    catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505') throw new ConflictException('Tenant slug already exists');
      throw error;
    }
  }

  async update(id: number, dto: UpdateTenantDto) {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    Object.assign(tenant, dto);
    return this.tenants.save(tenant);
  }

  async remove(id: number): Promise<void> {
    const tenant = await this.requireTenant(id);
    try {
      await this.tenants.remove(tenant);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23503') {
        throw new ConflictException('Cannot delete a tenant while users, outlets, or related records still reference it');
      }
      throw error;
    }
  }

  async outletsForTenant(tenantId: number) {
    await this.requireTenant(tenantId);
    return this.outlets.find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  async assignOutlet(outletId: number, tenantId: number) {
    const [outlet] = await Promise.all([
      this.outlets.findOne({ where: { id: outletId } }),
      this.requireTenant(tenantId),
    ]);
    if (!outlet) throw new NotFoundException(`Outlet ${outletId} not found`);
    outlet.tenantId = tenantId;
    return this.outlets.save(outlet);
  }

  private async requireTenant(id: number) {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }
}
