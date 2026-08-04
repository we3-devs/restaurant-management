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
   * Resolves the set of permission slugs granted to a user via any active,
   * in-window role assignment, regardless of scope (global or a specific
   * outlet/department/warehouse). There's no per-scope enforcement anywhere
   * else in the app yet (controllers only ever check "does this user hold
   * slug X at all", never "...at outlet Y"), so any active assignment
   * grants the permission flatly — matching how the frontend already
   * consumes this as a plain string array with no scope dimension.
   */
  async getPermissionSlugs(userId: number): Promise<Set<string>> {
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
      .andWhere('ura.is_active = true')
      .andWhere('(ura.starts_at IS NULL OR ura.starts_at <= now())')
      .andWhere('(ura.ends_at IS NULL OR ura.ends_at > now())')
      .getRawMany<{ slug: string }>();

    return new Set(rows.map((row) => row.slug));
  }

  /**
   * Which frontend app the user should land in after login, aggregated across
   * every active, in-window role assignment. A role explicitly marked
   * 'dashboard' or 'both' wins over 'staff' — someone holding a back-office
   * role alongside a staff one still needs the desktop app reachable. Users
   * with no active role assignment yet default to 'staff' (the safer, more
   * restricted landing).
   */
  async getPortalAccess(userId: number): Promise<'dashboard' | 'staff'> {
    const rows = await this.assignmentsRepository.manager
      .createQueryBuilder()
      .select('DISTINCT roles.portal', 'portal')
      .from('user_role_assignments', 'ura')
      .innerJoin(
        'roles',
        'roles',
        'roles.id = ura.role_id AND roles.is_active = true',
      )
      .where('ura.user_id = :userId', { userId })
      .andWhere('ura.is_active = true')
      .andWhere('(ura.starts_at IS NULL OR ura.starts_at <= now())')
      .andWhere('(ura.ends_at IS NULL OR ura.ends_at > now())')
      .getRawMany<{ portal: string }>();

    const portals = rows.map((row) => row.portal);
    if (portals.length === 0) return 'staff';
    return portals.some((portal) => portal === 'dashboard' || portal === 'both')
      ? 'dashboard'
      : 'staff';
  }

  /**
   * Distinct outlet IDs the user has an active, in-window role assignment
   * scoped to. Read-only lookup for the frontend's outlet picker — does not
   * change how PermissionsGuard evaluates access (see class doc above); an
   * empty result means the user holds only global (unscoped) assignments and
   * should be treated as having access to every outlet.
   */
  async getAccessibleOutletIds(userId: number): Promise<number[]> {
    const rows = await this.assignmentsRepository
      .createQueryBuilder('ura')
      .select('DISTINCT ura.outlet_id', 'outletId')
      .where('ura.user_id = :userId', { userId })
      .andWhere('ura.is_active = true')
      .andWhere('ura.outlet_id IS NOT NULL')
      .andWhere('(ura.starts_at IS NULL OR ura.starts_at <= now())')
      .andWhere('(ura.ends_at IS NULL OR ura.ends_at > now())')
      .getRawMany<{ outletId: string }>();

    return rows.map((row) => Number(row.outletId));
  }

  /**
   * Distinct outlet-department IDs the user has an active, in-window role
   * assignment scoped to — same read-only pattern as
   * getAccessibleOutletIds(), just one scope column over. Used by the
   * frontend to auto-pick the user's department (POS routing, KDS station
   * filter) instead of defaulting to "all"/first.
   */
  async getAccessibleOutletDepartmentIds(userId: number): Promise<number[]> {
    const rows = await this.assignmentsRepository
      .createQueryBuilder('ura')
      .select('DISTINCT ura.outlet_department_id', 'outletDepartmentId')
      .where('ura.user_id = :userId', { userId })
      .andWhere('ura.is_active = true')
      .andWhere('ura.outlet_department_id IS NOT NULL')
      .andWhere('(ura.starts_at IS NULL OR ura.starts_at <= now())')
      .andWhere('(ura.ends_at IS NULL OR ura.ends_at > now())')
      .getRawMany<{ outletDepartmentId: string }>();

    return rows.map((row) => Number(row.outletDepartmentId));
  }
}
