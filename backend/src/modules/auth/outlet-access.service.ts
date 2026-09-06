import { ForbiddenException, Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { PermissionsService } from './permissions.service';

export const ALL_OUTLETS = 'ALL' as const;
export type AccessibleOutlets = number[] | typeof ALL_OUTLETS;

/**
 * Single source of truth for "which outlets can this user touch". Wraps
 * PermissionsService.getAccessibleOutletIds — which returns `null` for a
 * user with zero active role assignments and `[]` for a user whose
 * assignment(s) are all global/unscoped — plus the superadmin bypass every
 * other guard in this app already grants, so callers get one unambiguous
 * ALL_OUTLETS sentinel (or a genuinely empty list, meaning "no outlets")
 * instead of re-deriving that meaning themselves at each call site.
 */
@Injectable({ scope: Scope.REQUEST })
export class OutletAccessService {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: Request & { tenantId?: number },
  ) {}

  async getAccessibleOutletIds(
    userId: number,
    isSuperadmin: boolean,
  ): Promise<AccessibleOutlets> {
    if (isSuperadmin) {
      // A tenant hostname scopes even superadmins. They retain full access
      // inside that tenant, but must not see another tenant's outlets.
      if (this.request.tenantId !== undefined) {
        const rows = await this.dataSource.query(
          'SELECT id FROM outlets WHERE tenant_id = $1 ORDER BY name ASC',
          [this.request.tenantId],
        );
        return rows.map((row: { id: string | number }) => Number(row.id));
      }
      return ALL_OUTLETS;
    }
    const outletIds = await this.permissionsService.getAccessibleOutletIds(
      userId,
    );
    if (outletIds === null) {
      // Zero active role assignments — not "global", just no access.
      return [];
    }
    return outletIds.length === 0 ? ALL_OUTLETS : outletIds;
  }

  async canAccessOutlet(
    userId: number,
    isSuperadmin: boolean,
    outletId: number,
  ): Promise<boolean> {
    const accessible = await this.getAccessibleOutletIds(userId, isSuperadmin);
    return accessible === ALL_OUTLETS || accessible.includes(outletId);
  }

  async assertOutletAccess(
    userId: number,
    isSuperadmin: boolean,
    outletId: number,
  ): Promise<void> {
    const allowed = await this.canAccessOutlet(userId, isSuperadmin, outletId);
    if (!allowed) {
      throw new ForbiddenException('You do not have access to this outlet');
    }
  }

  /** Resolves a reporting request to one safe active outlet. Undefined means all outlets for a superadmin. */
  async resolveReportingOutlet(user: User, requestedOutletId?: number): Promise<number | undefined> {
    const accessible = await this.getAccessibleOutletIds(user.id, user.isSuperadmin);
    if (requestedOutletId !== undefined) {
      await this.assertOutletAccess(user.id, user.isSuperadmin, requestedOutletId);
      return requestedOutletId;
    }
    if (accessible === ALL_OUTLETS) return undefined;
    if (accessible.length === 0) throw new ForbiddenException('You do not have access to any outlet');
    return accessible[0];
  }

  assertSuperadmin(user: User): void {
    if (!user.isSuperadmin) throw new ForbiddenException('Only a superadmin may perform this operation');
  }
}
