import type { ObjectLiteral } from 'typeorm';

/** Returns a usable outlet id when an entity carries one. */
export function extractOutletId(entity: ObjectLiteral): number | null {
  const raw = entity.outletId;
  if (raw === undefined || raw === null) return null;

  const outletId = Number(raw);
  return Number.isFinite(outletId) ? outletId : null;
}
