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

/**
 * Suggested segment for a name — first word, capped at four characters.
 * A suggestion only: "Chicken" yields CHIC, and an operator who wants CHI
 * overwrites it. Guessing the abbreviation someone prefers is not solvable.
 */
export function suggestSkuSegment(name: string): string {
  return normaliseSkuSegment(name.trim().split(/\s+/)[0] ?? '').slice(0, 4);
}

/**
 * Joins a path of segments into a SKU: ["MOMO", "CHI", "FULL"] -> MOMO-CHI-FULL.
 *
 * Returns null when the leading segment is missing — a variant SKU that
 * doesn't start with its food's code is worse than no SKU, since it reads as
 * belonging to some other item. Gaps further down are simply skipped.
 */
export function composeSku(segments: (string | null | undefined)[]): string | null {
  if (!segments.length || !segments[0]) return null;
  const parts = segments.filter((segment): segment is string => Boolean(segment));
  return parts.join(SKU_SEPARATOR);
}
