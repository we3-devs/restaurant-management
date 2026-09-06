import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantRequestContext {
  tenantId: number | null;
}

/** Carries the authenticated/request host tenant into database queries. */
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<TenantRequestContext>();

  run<T>(tenantId: number | null, callback: () => T): T {
    return this.storage.run({ tenantId }, callback);
  }

  getTenantId(): number | null {
    return this.storage.getStore()?.tenantId ?? null;
  }
}
