/**
 * Shared document/order-number generator: `{PREFIX}-{scopeId}-{timestamp}-{random4}`.
 * Simple and collision-resistant; a real sequential per-scope counter is a
 * nicety, not a correctness requirement, and can replace this later without
 * an API shape change.
 */
export function generateDocumentNumber(
  prefix: string,
  scopeId: number,
): string {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${scopeId}-${Date.now()}-${random}`;
}
