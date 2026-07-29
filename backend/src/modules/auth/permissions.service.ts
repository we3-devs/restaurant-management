import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleAssignment } from '../roles/entities/user-role-assignment.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(UserRoleAssignment)
    private readonly assignmentsRepository: Repository<UserRoleAssignment>,
  ) {}

  /**
   * Resolves the set of permission slugs granted to a user via active,
   * in-window, GLOBAL-scope role assignments only. Outlet/department/
   * warehouse-scoped resolution is deferred to a later phase.
   */
  async getGlobalPermissionSlugs(userId: number): Promise<Set<string>> {
    const rows = await this.assignmentsRepository.manager
      .createQueryBuilder()
      .select('DISTINCT permissions.slug', 'slug')
      .from('user_role_assignments', 'ura')
      .innerJoin(
        'roles',
        'roles',
        'roles.id = ura.role_id AND roles.is_active = true',
      )
      .innerJoin(
        'role_permissions',
        'role_permissions',
        'role_permissions.role_id = ura.role_id',
      )
      .innerJoin(
        'permissions',
        'permissions',
        'permissions.id = role_permissions.permission_id AND permissions.is_active = true',
      )
      .where('ura.user_id = :userId', { userId })
      .andWhere('ura.scope_type = :scopeType', { scopeType: 'global' })
      .andWhere('ura.is_active = true')
      .andWhere('(ura.starts_at IS NULL OR ura.starts_at <= now())')
      .andWhere('(ura.ends_at IS NULL OR ura.ends_at > now())')
      .getRawMany<{ slug: string }>();

    return new Set(rows.map((row) => row.slug));
  }
}
