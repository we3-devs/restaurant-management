import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { SKU_SEPARATOR } from '../../common/sku.util';

/**
 * Keeps composed SKUs in step with the segments they're built from.
 *
 * Lives in FoodsModule (not FoodVariantsModule) so both services can inject it:
 * FoodVariantsModule already imports FoodsModule, and the reverse would be a
 * circular dependency.
 *
 * Recomposition runs as SQL rather than load-modify-save because a food's
 * segment changing has to rewrite every variant beneath it — potentially
 * dozens of rows across two levels — and the join already knows the whole path.
 */
@Injectable()
export class SkuCompositionService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Rewrites `sku` for a food and every variant under it, from their segments.
   *
   * Rows with no segment of their own are skipped entirely, so a manually
   * entered SKU is never clobbered by this. concat_ws drops NULL parts, which
   * gives "skip the gap" for free when a middle level has no segment.
   */
  async recomposeFoodTree(foodId: number): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `UPDATE foods
             SET sku = sku_segment
           WHERE id = $1 AND sku_segment IS NOT NULL`,
          [foodId],
        );

        // The parent segment comes from a correlated subquery, not a join:
        // Postgres does not allow the UPDATE target ("v") to be referenced in
        // a FROM-clause join condition, but a scalar subquery may reference it.
        // Returns NULL for top-level rows, which concat_ws then skips.
        await manager.query(
          `UPDATE food_variants v
              SET sku = concat_ws(
                    $2,
                    f.sku_segment,
                    (SELECT p.sku_segment
                       FROM food_variants p
                      WHERE p.id = v.parent_id),
                    v.sku_segment
                  )
             FROM foods f
            WHERE v.food_id = f.id
              AND f.id = $1
              AND f.sku_segment IS NOT NULL
              AND v.sku_segment IS NOT NULL`,
          [foodId, SKU_SEPARATOR],
        );
      });
    } catch (error) {
      // The composed value lands in a UNIQUE column, so two identical paths
      // (same segments under the same food) collide here rather than silently
      // producing a duplicate code.
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'That SKU segment produces a code that already exists — give this level a different segment',
        );
      }
      throw error;
    }
  }
}
