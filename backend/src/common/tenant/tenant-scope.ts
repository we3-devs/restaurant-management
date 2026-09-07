import { FindOptionsWhere } from 'typeorm';
import { TenantContext } from './tenant-context';

/** Adds the active request tenant to a TypeORM where clause. */
export function scopedWhere<T extends object>(
  context: TenantContext,
  where: FindOptionsWhere<T>,
): FindOptionsWhere<T> {
  const tenantId = context.getTenantId();
  return tenantId === null ? where : ({ ...where, tenantId } as FindOptionsWhere<T>);
}

/** Fields copied onto directly-created tenant-owned rows. */
export function tenantFields(context: TenantContext): { tenantId?: number } {
  const tenantId = context.getTenantId();
  return tenantId === null ? {} : { tenantId };
}
