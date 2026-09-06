import { ValueTransformer } from 'typeorm';

/**
 * Postgres `bigint` columns come back from `pg` as strings to avoid silent
 * precision loss above Number.MAX_SAFE_INTEGER. RMS row counts will never
 * approach that, so every bigint PK/FK across all entities uses this to
 * work with plain JS numbers instead of strings everywhere.
 */
export class BigIntTransformer implements ValueTransformer {
  to(value?: number | null): number | null | undefined {
    return value;
  }

  from(value?: string | null): number | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }
    return parseInt(value, 10);
  }
}
