import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Binds a verified tenant hostname to the authenticated user's tenant. The
 * browser-facing Next proxy overwrites X-Tenant-Slug from Host; this guard is
 * the backend safety net for direct API callers.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { tenantId?: number }>();
    const slug = String(request.headers['x-tenant-slug'] ?? '').trim().toLowerCase();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    // Public guest routes still need a resolved tenant. Previously the early
    // @Public() return meant branding, table lookup, and menu requests were
    // always read from the shared/global dataset.
    if (slug) {
      const rows = await this.dataSource.query(
        `SELECT t.id FROM tenants t
         WHERE LOWER(t.slug) = $1 AND t.is_active = true
         LIMIT 1`,
        [slug],
      );
      if (!rows[0]) throw new ForbiddenException('Unknown or inactive tenant');
      request.tenantId = Number(rows[0].id);
    }

    if (isPublic) return true;
    if (!slug) return true;

    const user = request.user;
    if (!user) throw new ForbiddenException('Tenant context requires authentication');

    if (user.isSuperadmin) return true;

    if (user.tenantId === null) {
      throw new ForbiddenException('Invalid user tenant assignment');
    }

    const rows = await this.dataSource.query(
      `SELECT t.id
       FROM tenants t
       WHERE LOWER(t.slug) = $1
         AND t.is_active = true
         AND ($2::bigint IS NULL OR t.id = $2)
       LIMIT 1`,
      [slug, user.isSuperadmin ? null : user.tenantId],
    );

    if (!rows[0]) {
      throw new ForbiddenException(
        user.isSuperadmin
          ? 'Unknown or inactive tenant'
          : 'You do not have access to this tenant',
      );
    }
    request.tenantId = Number(rows[0].id);

    if (user.isSuperadmin) return true;

    const invalidAssignments = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM user_role_assignments ura
       LEFT JOIN outlets o ON o.id = ura.outlet_id
       WHERE ura.user_id = $1
         AND ura.is_active = true
         AND (ura.starts_at IS NULL OR ura.starts_at <= now())
         AND (ura.ends_at IS NULL OR ura.ends_at > now())
         AND ura.outlet_id IS NOT NULL
         AND (o.id IS NULL OR o.tenant_id <> $2)`,
      [user.id, user.tenantId],
    );
    if (Number(invalidAssignments[0]?.count ?? 0) > 0) {
      throw new ForbiddenException('Invalid user tenant/outlet assignment');
    }
    return true;
  }
}
