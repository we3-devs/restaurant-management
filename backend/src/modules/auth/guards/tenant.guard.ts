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
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { tenantId?: number }>();
    const slug = String(request.headers['x-tenant-slug'] ?? '').trim().toLowerCase();
    if (!slug) return true;

    const user = request.user;
    if (!user) throw new ForbiddenException('Tenant context requires authentication');

    if (user.isSuperadmin) return true;

    if (user.tenantId === null) {
      throw new ForbiddenException('Invalid user tenant assignment');
    }

    const rows = await this.dataSource.query(
      `SELECT t.id,
              COALESCE(array_agg(DISTINCT ura.outlet_id)
                FILTER (WHERE ura.outlet_id IS NOT NULL), '{}') AS outlet_ids,
              COUNT(*) FILTER (
                WHERE ura.outlet_id IS NOT NULL
                  AND (o.id IS NULL OR o.tenant_id <> t.id)
              ) AS invalid_outlet_assignments
       FROM tenants t
       LEFT JOIN user_role_assignments ura
         ON ura.user_id = $3
        AND ura.is_active = true
        AND (ura.starts_at IS NULL OR ura.starts_at <= now())
        AND (ura.ends_at IS NULL OR ura.ends_at > now())
       LEFT JOIN outlets o ON o.id = ura.outlet_id
       WHERE LOWER(t.slug) = $1
         AND t.is_active = true
         AND t.id = $2
       LIMIT 1`,
      [slug, user.tenantId, user.id],
    );

    if (!rows[0]) throw new ForbiddenException('You do not have access to this tenant');
    if (Number(rows[0].invalid_outlet_assignments) > 0) {
      throw new ForbiddenException('Invalid user tenant/outlet assignment');
    }
    request.tenantId = Number(rows[0].id);
    return true;
  }
}
