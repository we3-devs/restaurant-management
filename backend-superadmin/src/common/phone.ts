import { BadRequestException } from '@nestjs/common';

/** Accepts local Nepal mobile input or the same number prefixed with +977. */
export function normalizeNepalPhone(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '');
  const local = compact.startsWith('+977')
    ? compact.slice(4)
    : compact.startsWith('977') && compact.length === 13
      ? compact.slice(3)
      : compact;

  if (!/^9\d{9}$/.test(local)) {
    throw new BadRequestException(
      'Phone must be a valid Nepal mobile number, e.g. 9700000000 or +977 970-0000000',
    );
  }
  return local;
}

/** Shape accepted by class-validator before the service canonicalizes it. */
export const NEPAL_PHONE_PATTERN = /^(?:(?:\+977[ -]?)?9\d{2}[ -]?\d{7})$/;
