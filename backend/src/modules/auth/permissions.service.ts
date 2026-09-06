import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { PoolMetrics } from '../../common/instrumentation/pool-metrics';
import { UserRoleAssignment } from '../roles/entities/user-role-assignment.entity';

interface ActiveAssignmentRow {
  slug: string | null;
  portal: string | null;
  outletId: string | null;
  outletDepartmentId: string | null;
  roleSlug: string | null;
  tenantId: string | null;
  outletTenantId: string | null;
}

// Every method below reads from the same underlying active-role-assignment
// set for a user, and used to run as 4 independent, uncached queries against
// user_role_assignments (each ~150-200ms against the remote DB). Callers
// like AuthController.me and PermissionsGuard often need 2+ of them for a
// single request, so this fetches the whole set once and derives every
// result from the cached rows in memory. Same TTL/revocation tradeoff as
// JwtAccessStrategy's user cache (see USER_CACHE_TTL_MS there).
const ASSIGNMENTS_CACHE_TTL_MS = 15_000;

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @InjectRepository(UserRoleAssignment)
    private readonly assignmentsRepository: Repository<UserRoleAssignment>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly poolMetrics: PoolMetrics,
  ) {}

  private async getActiveAssignmentRows(
    userId: number,
  ): Promise<ActiveAssignmentRow[]> {
    const cacheKey = `auth:assignments:${userId}`;
    const cached = await this.cache.get<ActiveAssignmentRow[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const dbStartUs = this.nowMicros();
    const rows = await this.assignmentsRepository.manager
      .createQueryBuilder()
      .select('permissions.slug', 'slug')
      .addSelect('roles.portal', 'portal')
      .addSelect('ura.outlet_id', 'outletId')
      .addSelect('ura.outlet_department_id', 'outletDepartmentId')
      .addSelect('roles.slug', 'roleSlug')
      .addSelect('user.tenant_id', 'tenantId')
      .addSelect('assigned_outlet.tenant_id', 'outletTenantId')
      .from('user_role_assignments', 'ura')
      .innerJoin('users', 'user', 'user.id = ura.user_id')
      .innerJoin(
        'roles',
        'roles',
        'roles.id = ura.role_id AND roles.is_active = true',
      )
      .leftJoin(
        'role_permissions',
        'role_permissions',
        'role_permissions.role_id = ura.role_id',
      )
      .leftJoin(
        'permissions',
        'permissions',
        'permissions.id = role_permissions.permission_id AND permissions.is_active = true',
      )
      .leftJoin(
        'outlets',
        'assigned_outlet',
        'assigned_outlet.id = ura.outlet_id',
      )
      .where('ura.user_id = :userId', { userId })
      .andWhere('ura.is_active = true')
      .andWhere('(ura.starts_at IS NULL OR ura.starts_at <= now())')
      .andWhere('(ura.ends_at IS NULL OR ura.ends_at > now())')
      .getRawMany<ActiveAssignmentRow>();
    const dbDurationMs = Math.round((this.nowMicros() - dbStartUs) / 1000);

    await this.cache.set(cacheKey, rows, ASSIGNMENTS_CACHE_TTL_MS);
    this.logger.log(
      `[PERF:PERM_CACHE] userId=${userId} hit=false ${dbDurationMs}ms rows=${rows.length}`
    );
    return rows;
  }

  private nowMicros(): number {
    const [seconds, nanos] = process.hrtime();
    return seconds * 1_000_000 + Math.round(nanos / 1_000);
  }

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
    const rows = await this.getActiveAssignmentRows(userId);
    return new Set(
      rows
        .map((row) => row.slug)
        .filter((slug): slug is string => slug !== null),
    );
  }

  /**
   * One-off check for a permission finer-grained than a route-level
   * @RequirePermissions() slug — e.g. gating one field of an otherwise
   * broadly-permitted payload (discount on order update, refund on payment
   * create). Callers must still pass isSuperadmin themselves; this never
   * short-circuits it.
   */
  async hasPermission(userId: number, slug: string): Promise<boolean> {
    const slugs = await this.getPermissionSlugs(userId);
    return slugs.has(slug);
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
    const rows = await this.getActiveAssignmentRows(userId);
    const portals = new Set(rows.map((row) => row.portal));
    if (portals.size === 0) return 'staff';
    return portals.has('dashboard') || portals.has('both')
      ? 'dashboard'
      : 'staff';
  }

  /**
   * Whether the user can reach both apps: either an explicit 'both' role, or
   * separate 'dashboard' and 'staff' role assignments combined. Drives the
   * portal switcher in the header nav — getPortalAccess() only reports where
   * "/" lands them, which collapses 'both' down to 'dashboard'.
   */
  async hasBothPortals(userId: number): Promise<boolean> {
    const rows = await this.getActiveAssignmentRows(userId);
    const portals = new Set(rows.map((row) => row.portal));
    return (
      portals.has('both') || (portals.has('dashboard') && portals.has('staff'))
    );
  }

  /**
   * Distinct outlet IDs the user has an active, in-window role assignment
   * scoped to. Read-only lookup for the frontend's outlet picker — does not
   * change how PermissionsGuard evaluates access (see class doc above).
   *
   * Returns `null` (not `[]`) when the user has zero active role assignments,
   * so callers can tell "no roles at all → no outlet access" apart from "has
   * assignment(s), all global/unscoped → access to every outlet" (`[]`).
   * Collapsing those two cases used to both read as "empty array" and let
   * OutletAccessService treat a role-less user as having ALL_OUTLETS access.
   */
  async getAccessibleOutletIds(userId: number): Promise<number[] | null> {
    const rows = await this.getActiveAssignmentRows(userId);
    if (rows.length === 0) {
      return null;
    }
    const tenantId = rows.find((row) => row.tenantId !== null)?.tenantId;
    if (tenantId === null || tenantId === undefined) return [];

    if (rows.some((row) => row.outletId === null)) {
      const outlets = await this.assignmentsRepository.manager.query(
        'SELECT id FROM outlets WHERE tenant_id = $1',
        [tenantId],
      ) as Array<{ id: string }>;
      return outlets.map((outlet) => Number(outlet.id));
    }

    return [
      ...new Set(
        rows
          .filter((row) => row.outletTenantId === tenantId)
          .map((row) => row.outletId)
          .filter((id): id is string => id !== null)
          .map(Number),
      ),
    ];
  }

  /**
   * Distinct slugs of every role the user holds an active, in-window
   * assignment for — used by the frontend to tell roles apart for UI
   * purposes (e.g. narrowing the sidebar for "admin") beyond what the flat
   * permission set alone can express.
   */
  async getRoleSlugs(userId: number): Promise<string[]> {
    const rows = await this.getActiveAssignmentRows(userId);
    return [
      ...new Set(
        rows
          .map((row) => row.roleSlug)
          .filter((slug): slug is string => slug !== null),
      ),
    ];
  }

  /**
   * Distinct outlet-department IDs the user has an active, in-window role
   * assignment scoped to — same read-only pattern as
   * getAccessibleOutletIds(), just one scope column over. Used by the
   * frontend to auto-pick the user's department (POS routing, KDS station
   * filter) instead of defaulting to "all"/first.
   */
  async getAccessibleOutletDepartmentIds(userId: number): Promise<number[]> {
    const rows = await this.getActiveAssignmentRows(userId);
    return [
      ...new Set(
        rows
          .map((row) => row.outletDepartmentId)
          .filter((id): id is string => id !== null)
          .map(Number),
      ),
    ];
  }

  async isKitchenStaff(userId: number): Promise<boolean> {
    const rows = await this.assignmentsRepository.manager.query(
      `SELECT 1
       FROM employees e
       LEFT JOIN positions p ON p.id = e.position_id
       WHERE e.user_id = $1
         AND e.is_active = true
         AND (
           LOWER(COALESCE(p.slug, '')) IN ('cook', 'chef', 'kitchen-helper', 'kitchen-staff', 'dishwasher')
           OR EXISTS (
             SELECT 1
             FROM user_role_assignments kitchen_ura
             INNER JOIN roles kitchen_role ON kitchen_role.id = kitchen_ura.role_id
             WHERE kitchen_ura.user_id = e.user_id
               AND kitchen_ura.is_active = true
               AND LOWER(kitchen_role.slug) IN ('cook', 'chef', 'kitchen-helper', 'kitchen-staff')
           )
         )
       LIMIT 1`,
      [userId],
    );
    return rows.length > 0;
  }

  async getEmployeeDepartmentIds(userId: number, outletId: number): Promise<number[]> {
    const rows = await this.assignmentsRepository.manager.query(
      `SELECT DISTINCT department_id AS "departmentId"
       FROM (
         SELECT eda.department_id
         FROM employee_department_assignments eda
         INNER JOIN employees e ON e.id = eda.employee_id
         INNER JOIN outlet_departments d ON d.id = eda.department_id
         WHERE e.user_id = $1
           AND e.outlet_id = $2
           AND e.is_active = true
           AND d.outlet_id = e.outlet_id
           AND d.is_active = true

         UNION

         SELECT ura.outlet_department_id AS department_id
         FROM user_role_assignments ura
         INNER JOIN outlet_departments d ON d.id = ura.outlet_department_id
         WHERE ura.user_id = $1
           AND ura.is_active = true
           AND ura.outlet_department_id IS NOT NULL
           AND d.outlet_id = $2
           AND d.is_active = true
       ) assigned_departments`,
      [userId, outletId],
    );
    return rows.map((row: { departmentId: string | number }) => Number(row.departmentId));
  }
}
