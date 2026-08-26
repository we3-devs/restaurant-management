import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ingredients typed 'raw_material'/'ready_product' no longer support stock
 * tracking (see IngredientsService.assertTrackable / isTrackableIngredientType)
 * — they're now catalog-only references used in recipes for costing/display,
 * with no stock balance and no order-time reservation. Any reservation or
 * balance already sitting against one of these ingredients from before this
 * change would otherwise be silently orphaned (never visible or adjustable
 * again through the stock screens), so this releases/zeroes them once.
 */
export class ReleaseUntrackedIngredientStock1774300000000
  implements MigrationInterface
{
  name = 'ReleaseUntrackedIngredientStock1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE order_item_ingredient_reservations r
      SET status = 'released',
          updated_at = now()
      FROM ingredients i
      WHERE r.ingredient_id = i.id
        AND r.status = 'reserved'
        AND i.type IN ('raw_material', 'ready_product')
    `);

    await queryRunner.query(`
      UPDATE warehouse_ingredient_stocks s
      SET quantity = 0,
          reserved_quantity = 0,
          stock_value = 0,
          updated_at = now()
      FROM ingredients i
      WHERE s.ingredient_id = i.id
        AND i.type IN ('raw_material', 'ready_product')
        AND (s.quantity <> 0 OR s.reserved_quantity <> 0 OR s.stock_value <> 0)
    `);
  }

  // Not reversible: the exact reservation/quantity values being cleared
  // aren't worth restoring, since they represented an untracked-going-
  // forward ingredient type rather than a real balance to recover.
  public async down(): Promise<void> {
    return;
  }
}
