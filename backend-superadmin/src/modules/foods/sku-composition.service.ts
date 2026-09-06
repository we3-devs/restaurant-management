import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { SKU_SEPARATOR } from '../../common/sku.util';

/**
 * A SKU part, derived from a name unless an explicit segment overrides it.
 *
 * This is what makes codes automatic: nothing has to be configured for a food
 * item to get FOOD-VARIANT-SUBVARIANT. Typing a segment is only for when the
 * derived word is too long — set CHI on the Chicken variant and every item
 * using it becomes ...-CHI-... instead of ...-CHICKEN-....
 *
 * Non-alphanumerics are stripped so a name like "Test Pizza - 1786" cannot
 * introduce a stray separator and split the code into the wrong number of parts.
 */
const part = (table: string) =>
  `NULLIF(COALESCE(NULLIF(${table}.sku_segment, ''), upper(regexp_replace(${table}.name, '[^a-zA-Z0-9]', '', 'g'))), '')`;

/**
 * Keeps composed SKUs in step with the names and segments they're built from.
 *
 * Lives in FoodsModule (not FoodVariantsModule) so both services can inject it:
 * FoodVariantsModule already imports FoodsModule, and the reverse would be a
 * circular dependency.
 *
 * Recomposition runs as SQL rather than load-modify-save because one rename can
 * rewrite every item of every food using that value, and the joins already know
 * the whole path.
 */
@Injectable()
export class SkuCompositionService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Rewrites `sku` for a food and all of its items.
   *
   * Pass `existing` to join the caller's transaction. Callers that create a food
   * and then recompose must do so, otherwise a failure here (a colliding code,
   * say) leaves the new row committed while the request returns an error.
   */
  async recomposeFoodTree(
    foodId: number,
    existing?: EntityManager,
  ): Promise<void> {
    return this.recompose(`f.id = $1`, [foodId], existing);
  }

  /** Every food — used to backfill after a change to how codes are derived. */
  async recomposeAll(existing?: EntityManager): Promise<void> {
    return this.recompose(`f.deleted_at IS NULL`, [], existing);
  }

  /**
   * Every food holding an item that uses this list value. Renaming "Chicken" or
   * giving it a segment has to reach each affected food, not just one.
   */
  async recomposeForListValue(
    kind: 'variant' | 'sub-variant',
    valueId: number,
    existing?: EntityManager,
  ): Promise<void> {
    const column = kind === 'variant' ? 'variant_id' : 'sub_variant_id';
    return this.recompose(
      `f.id IN (SELECT food_id FROM food_variants WHERE ${column} = $1)`,
      [valueId],
      existing,
    );
  }

  private async recompose(
    where: string,
    params: unknown[],
    existing?: EntityManager,
  ): Promise<void> {
    // $1 may be taken by the scope filter, so the separator is inlined rather
    // than parameterised — it is a module constant, never user input.
    const sep = `'${SKU_SEPARATOR}'`;

    try {
      const run = async (manager: EntityManager) => {
        await manager.query(
          `UPDATE foods f SET sku = ${part('f')} WHERE ${where}`,
          params,
        );

        // A food item's code is exactly food-variant-subvariant. Both dimension
        // parts are read via correlated subqueries rather than joins: Postgres
        // does not allow the UPDATE target ("v") in a FROM-clause join
        // condition, but a scalar subquery may reference it. concat_ws drops
        // NULLs, so an item with no variant or size composes to just the food's
        // code.
        await manager.query(
          `UPDATE food_variants v
              SET sku = concat_ws(
                    ${sep},
                    ${part('f')},
                    (SELECT ${part('va')} FROM variants va WHERE va.id = v.variant_id),
                    (SELECT ${part('sv')} FROM sub_variants sv WHERE sv.id = v.sub_variant_id)
                  )
             FROM foods f
            WHERE v.food_id = f.id
              AND v.deleted_at IS NULL
              AND (${where})`,
          params,
        );
      };

      await (existing
        ? run(existing)
        : this.dataSource.transaction((manager) => run(manager)));
    } catch (error) {
      // The composed value lands in a UNIQUE column, so two foods deriving the
      // same code (same name, or the same explicit segment) collide here rather
      // than silently producing a duplicate.
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'That name or SKU code produces a code that already exists — give this one a distinct SKU code',
        );
      }
      throw error;
    }
  }
}
