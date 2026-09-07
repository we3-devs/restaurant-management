import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionsRepository: Repository<RolePermission>,
  ) {}

  async findAll(
    query: ListRolesQueryDto,
  ): Promise<PaginatedResponse<RoleResponseDto>> {
    const { page, limit, search } = query;
    const [roles, total] = await this.rolesRepository.findAndCount({
      where: search
        ? [{ name: ILike(`%${search}%`) }, { slug: ILike(`%${search}%`) }]
        : {},
      order: { rank: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: roles,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by UsersService to validate a roleId — throws if missing. */
  async findOne(id: number): Promise<Role> {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    return role;
  }

  async findOneWithPermissions(id: number): Promise<RoleResponseDto> {
    const role = await this.findOne(id);
    const permissions = await this.getPermissionSlugs(id);
    return { ...role, permissions };
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const role = this.rolesRepository.create({
      name: dto.name,
      slug: dto.slug,
      level: dto.level ?? 'global',
      rank: dto.rank ?? 100,
      isAssignable: dto.isAssignable ?? true,
      isActive: true,
      portal: dto.portal ?? 'dashboard',
      isSystem: false,
      description: dto.description ?? null,
    });

    try {
      return await this.rolesRepository.save(role);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `Role slug "${dto.slug}" is already in use`,
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);

    Object.assign(role, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.rank !== undefined && { rank: dto.rank }),
      ...(dto.isAssignable !== undefined && { isAssignable: dto.isAssignable }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.portal !== undefined && { portal: dto.portal }),
      ...(dto.description !== undefined && { description: dto.description }),
    });

    return this.rolesRepository.save(role);
  }

  async remove(id: number): Promise<void> {
    const role = await this.findOne(id);
    // role_permissions and user_role_assignments both ON DELETE CASCADE —
    // this silently revokes the role from every currently-assigned user.
    await this.rolesRepository.remove(role);
  }

  async assignPermission(
    roleId: number,
    dto: AssignPermissionDto,
  ): Promise<void> {
    const role = await this.findOne(roleId);

    const permission = await this.permissionsRepository.findOne({
      where: { id: dto.permissionId },
    });
    if (!permission) {
      throw new NotFoundException(`Permission ${dto.permissionId} not found`);
    }

    const existing = await this.rolePermissionsRepository.findOne({
      where: { roleId, permissionId: dto.permissionId },
    });
    if (existing) {
      return; // idempotent
    }

    await this.rolePermissionsRepository.save(
      this.rolePermissionsRepository.create({
        roleId,
        permissionId: dto.permissionId,
      }),
    );
  }

  async unassignPermission(
    roleId: number,
    permissionId: number,
  ): Promise<void> {
    const role = await this.findOne(roleId);
    await this.rolePermissionsRepository.delete({ roleId, permissionId });
  }

  async listPermissions(): Promise<Permission[]> {
    return this.permissionsRepository.find({
      order: { module: 'ASC', action: 'ASC' },
    });
  }

  async importTemplates(tenantId: number): Promise<{ imported: string[] }> {
    const tenant = await this.rolesRepository.manager.query(
      'SELECT id FROM tenants WHERE id = $1 AND is_active = true',
      [tenantId],
    );
    if (!tenant[0]) throw new NotFoundException(`Tenant ${tenantId} not found`);

    await this.ensureReusableTemplates();
    const templates = await this.rolesRepository.find({
      where: { tenantId: IsNull() },
      order: { rank: 'ASC', name: 'ASC' },
    });
    const imported: string[] = [];
    for (const template of templates) {
      let role = await this.rolesRepository.findOne({ where: { tenantId, slug: template.slug } });
      if (!role) {
        role = await this.rolesRepository.save(this.rolesRepository.create({
          name: template.name,
          slug: template.slug,
          tenantId,
          level: template.level,
          rank: template.rank,
          portal: template.portal,
          isAssignable: template.isAssignable,
          isSystem: false,
          isActive: template.isActive,
          description: template.description,
        }));
        imported.push(role.slug);
      }

      const templatePermissions = await this.rolePermissionsRepository.find({ where: { roleId: template.id } });
      for (const templatePermission of templatePermissions) {
        const existing = await this.rolePermissionsRepository.findOne({
          where: { roleId: role.id, permissionId: templatePermission.permissionId },
        });
        if (!existing) {
          await this.rolePermissionsRepository.save(this.rolePermissionsRepository.create({
            roleId: role.id,
            permissionId: templatePermission.permissionId,
          }));
        }
      }
    }
    await this.rolesRepository.manager.query(
      `INSERT INTO positions (name, slug, description, default_role_id, tenant_id, is_active, created_at, updated_at)
       SELECT p.name, p.slug, p.description, target.id, $1, p.is_active, now(), now()
       FROM positions p
       INNER JOIN roles source ON source.id = p.default_role_id AND source.tenant_id IS NULL
       INNER JOIN roles target ON target.slug = source.slug AND target.tenant_id = $1
       WHERE p.tenant_id IS NULL
       ON CONFLICT (tenant_id, slug) DO NOTHING`,
      [tenantId],
    );
    return { imported };
  }

  /**
   * Older databases have the default roles attached to the first tenant
   * instead of storing them as reusable control-plane templates. Promote the
   * most complete existing tenant role set once so every tenant can import it.
   */
  private async ensureReusableTemplates(): Promise<void> {
    const templateCount = await this.rolesRepository.manager.query(
      'SELECT COUNT(*)::int AS count FROM roles WHERE tenant_id IS NULL',
    );
    if (Number(templateCount[0]?.count ?? 0) > 0) return;

    const [source] = await this.rolesRepository.manager.query(
      `SELECT tenant_id
       FROM roles
       WHERE tenant_id IS NOT NULL
       GROUP BY tenant_id
       ORDER BY COUNT(*) DESC, tenant_id ASC
       LIMIT 1`,
    ) as Array<{ tenant_id: string }>;
    if (!source) return;

    const sourceRoles = await this.rolesRepository.find({
      where: { tenantId: Number(source.tenant_id) },
      order: { rank: 'ASC', name: 'ASC' },
    });
    for (const sourceRole of sourceRoles) {
      let template = await this.rolesRepository.findOne({ where: { tenantId: IsNull(), slug: sourceRole.slug } });
      if (!template) {
        template = await this.rolesRepository.save(this.rolesRepository.create({
          name: sourceRole.name,
          slug: sourceRole.slug,
          tenantId: null,
          level: sourceRole.level,
          rank: sourceRole.rank,
          portal: sourceRole.portal,
          isAssignable: sourceRole.isAssignable,
          isSystem: false,
          isActive: sourceRole.isActive,
          description: sourceRole.description,
        }));
      }

      const permissions = await this.rolePermissionsRepository.find({ where: { roleId: sourceRole.id } });
      for (const permission of permissions) {
        const exists = await this.rolePermissionsRepository.findOne({ where: { roleId: template.id, permissionId: permission.permissionId } });
        if (!exists) await this.rolePermissionsRepository.save(this.rolePermissionsRepository.create({ roleId: template.id, permissionId: permission.permissionId }));
      }
    }

    await this.rolesRepository.manager.query(
      `INSERT INTO positions (name, slug, description, default_role_id, tenant_id, is_active, created_at, updated_at)
       SELECT p.name, p.slug, p.description, target.id, NULL, p.is_active, now(), now()
       FROM positions p
       INNER JOIN roles source ON source.id = p.default_role_id AND source.tenant_id = $1
       INNER JOIN roles target ON target.slug = source.slug AND target.tenant_id IS NULL
       WHERE p.tenant_id = $1
       ON CONFLICT (slug) WHERE tenant_id IS NULL DO NOTHING`,
      [Number(source.tenant_id)],
    );
  }

  private async getPermissionSlugs(roleId: number): Promise<string[]> {
    const rows = await this.rolePermissionsRepository.find({
      where: { roleId },
      relations: { permission: true },
    });
    return rows.map((row) => row.permission.slug);
  }

}
