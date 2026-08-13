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
    const assignStartUs = this.nowMicros();
    const cached = await this.cache.get<ActiveAssignmentRow[]>(cacheKey);
    if (cached) {
      const cacheHitMs = Math.round((this.nowMicros() - assignStartUs) / 1000);
      this.logger.debug(
        `[PERF:PERM_CACHE] userId=${userId} hit=true ${cacheHitMs}ms rows=${cached.length}`
      );
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
      .from('user_role_assignments', 'ura')
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
   * Distinct outlet IDs the user has an active, in-window role assignment
   * scoped to. Read-only lookup for the frontend's outlet picker — does not
   * change how PermissionsGuard evaluates access (see class doc above); an
   * empty result means the user holds only global (unscoped) assignments and
   * should be treated as having access to every outlet.
   */
  async getAccessibleOutletIds(userId: number): Promise<number[]> {
    const rows = await this.getActiveAssignmentRows(userId);
    return [
      ...new Set(
        rows
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
}
