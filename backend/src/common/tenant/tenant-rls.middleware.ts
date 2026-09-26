import { Injectable, NestMiddleware } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { NextFunction, Request, Response } from 'express';
import { TenantContext } from './tenant-context';

const SLUG_CACHE_TTL_MS = 60_000;

interface CachedTenant {
  tenantId: number | null;
  expiresAt: number;
}

@Injectable()
export class TenantRlsMiddleware implements NestMiddleware {
  // Every request was hitting the DB to resolve slug -> tenantId; tenants
  // rarely change, so cache the mapping in memory instead of round-tripping
  // on the hot path of every single request.
  private readonly slugCache = new Map<string, CachedTenant>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContext,
  ) {}

  async use(request: Request & { tenantId?: number }, _response: Response, next: NextFunction): Promise<void> {
    const slug = String(request.headers['x-tenant-slug'] ?? '').trim().toLowerCase();
    if (!slug) {
      this.tenantContext.run(null, next);
      return;
    }

    const tenantId = await this.resolveTenantId(slug);
    request.tenantId = tenantId ?? undefined;
    this.tenantContext.run(tenantId, next);
  }

  private async resolveTenantId(slug: string): Promise<number | null> {
    const cached = this.slugCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenantId;
    }

    const rows = await this.dataSource.query(
      `SELECT id FROM tenants WHERE LOWER(slug) = $1 AND is_active = true LIMIT 1`,
      [slug],
    );
    const tenantId = rows[0] ? Number(rows[0].id) : null;
    this.slugCache.set(slug, { tenantId, expiresAt: Date.now() + SLUG_CACHE_TTL_MS });
    return tenantId;
  }
}
