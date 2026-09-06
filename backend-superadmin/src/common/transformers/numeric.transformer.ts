import { ValueTransformer } from 'typeorm';

/**
 * Postgres `numeric` columns come back from `pg` as strings to avoid silent
 * float precision loss. Price fields in this schema never need more than
 * JS-number precision, so this converts both directions for plain `number`
 * use everywhere a `numeric` column is mapped.
 */
export class NumericTransformer implements ValueTransformer {
  to(value?: number | null): number | null | undefined {
    return value;
  }

  from(value?: string | null): number | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }
    return Number(value);
  }
}
