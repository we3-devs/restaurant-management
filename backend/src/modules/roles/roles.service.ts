import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, QueryFailedError, Repository } from 'typeorm';
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
    this.assertNotSystem(role, 'update');

    Object.assign(role, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.rank !== undefined && { rank: dto.rank }),
      ...(dto.isAssignable !== undefined && { isAssignable: dto.isAssignable }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.description !== undefined && { description: dto.description }),
    });

    return this.rolesRepository.save(role);
  }

  async remove(id: number): Promise<void> {
    const role = await this.findOne(id);
    this.assertNotSystem(role, 'delete');
    // role_permissions and user_role_assignments both ON DELETE CASCADE —
    // this silently revokes the role from every currently-assigned user.
    await this.rolesRepository.remove(role);
  }

  async assignPermission(
    roleId: number,
    dto: AssignPermissionDto,
  ): Promise<void> {
    const role = await this.findOne(roleId);
    this.assertNotSystem(role, 'assign a permission to');

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
    this.assertNotSystem(role, 'unassign a permission from');
    await this.rolePermissionsRepository.delete({ roleId, permissionId });
  }

  async listPermissions(): Promise<Permission[]> {
    return this.permissionsRepository.find({
      order: { module: 'ASC', action: 'ASC' },
    });
  }

  private async getPermissionSlugs(roleId: number): Promise<string[]> {
    const rows = await this.rolePermissionsRepository.find({
      where: { roleId },
      relations: { permission: true },
    });
    return rows.map((row) => row.permission.slug);
  }

  private assertNotSystem(role: Role, action: string): void {
    if (role.isSystem) {
      throw new ForbiddenException(
        `Cannot ${action} the system role "${role.slug}"`,
      );
    }
  }
}
