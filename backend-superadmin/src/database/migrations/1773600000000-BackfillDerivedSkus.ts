import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills every SKU now that codes are derived rather than configured.
 *
 * A code is FOOD-VARIANT-SUBVARIANT, each part taken from that row's name and
 * only overridden by an explicit sku_segment. Previously composition ran solely
 * for foods that had a segment typed in, which left most of the menu on
 * hand-entered codes — inconsistently cased, and in one case a typo ("SPI-MINI"
 * for Sprite).
 *
 * This rewrites those hand-entered codes. That is the point: they were the
 * problem. Anything worth preserving can be pinned afterwards by setting an
 * explicit segment.
 */
export class BackfillDerivedSkus1773600000000 implements MigrationInterface {
  name = 'BackfillDerivedSkus1773600000000';

  // Mirrors SkuCompositionService's `part()` — kept in sync by hand because a
  // migration must keep producing the same result as of this point in history,
  // even if the service's derivation changes later.
  private part(alias: string): string {
    return `NULLIF(COALESCE(NULLIF(${alias}.sku_segment, ''), upper(regexp_replace(${alias}.name, '[^a-zA-Z0-9]', '', 'g'))), '')`;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE foods f SET sku = ${this.part('f')} WHERE f.deleted_at IS NULL`,
    );

    await queryRunner.query(`
      UPDATE food_variants v
         SET sku = concat_ws(
               '-',
               ${this.part('f')},
               (SELECT ${this.part('va')} FROM variants va WHERE va.id = v.variant_id),
               (SELECT ${this.part('sv')} FROM sub_variants sv WHERE sv.id = v.sub_variant_id)
             )
        FROM foods f
       WHERE v.food_id = f.id
         AND v.deleted_at IS NULL
    `);
  }

  // No down(): the previous values were inconsistent hand-entered strings with
  // no recoverable rule, so restoring them is not possible. Codes simply stay
  // derived.
  public async down(): Promise<void> {
    return;
  }
}
