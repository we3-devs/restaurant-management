export const SKU_SEGMENT_MAX = 32;
export const SKU_SEPARATOR = '-';

/**
 * Normalises whatever an operator typed into a segment: uppercase, and only
 * A-Z/0-9 kept so a stray space or slash can't break the composed code apart
 * at the separator.
 */
export function normaliseSkuSegment(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, SKU_SEGMENT_MAX);
}
