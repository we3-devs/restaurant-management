import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Outlet } from '../outlets/entities/outlet.entity';
import { CreateOutletDto } from '../outlets/dto/create-outlet.dto';
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

  async createOutlet(tenantId: number, dto: CreateOutletDto) {
    await this.requireTenant(tenantId);
    const slugBase = dto.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'outlet';
    const outlet = this.outlets.create({ name: dto.name.trim(), slug: `${slugBase}-${Date.now().toString(36)}`.slice(0, 80), tenantId });
    return this.outlets.save(outlet);
  }

  async summary(tenantId: number) {
    const tenant = await this.tenants.findOne({ where: { id: tenantId }, relations: { outlets: true } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const tables = await this.tenants.manager.query(`
      SELECT table_name,
        bool_or(column_name = 'tenant_id') AS has_tenant_id,
        bool_or(column_name = 'outlet_id') AS has_outlet_id
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name NOT IN ('tenants', 'migrations', 'typeorm_migrations')
      GROUP BY table_name
      ORDER BY table_name
    `) as Array<{ table_name: string; has_tenant_id: boolean; has_outlet_id: boolean }>;

    const modules = [] as Array<{ key: string; label: string; count: number; scope: 'tenant' | 'outlet' }>;
    for (const table of tables) {
      if (!table.has_tenant_id && !table.has_outlet_id) continue;
      const quotedTable = `"${table.table_name.replace(/"/g, '""')}"`;
      const query = table.has_tenant_id
        ? `SELECT COUNT(*)::int AS count FROM ${quotedTable} WHERE tenant_id = $1`
        : `SELECT COUNT(*)::int AS count FROM ${quotedTable} record INNER JOIN outlets outlet ON outlet.id = record.outlet_id WHERE outlet.tenant_id = $1`;
      const [row] = await this.tenants.manager.query(query, [tenantId]) as Array<{ count: number }>;
      const key = table.table_name.replace(/_/g, '-');
      modules.push({ key, label: key.replace(/(^|-)([a-z])/g, (_, separator, letter) => `${separator ? ' ' : ''}${letter.toUpperCase()}`), count: Number(row?.count ?? 0), scope: table.has_tenant_id ? 'tenant' : 'outlet' });
    }

    return { tenant, outlets: tenant.outlets ?? [], modules };
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
