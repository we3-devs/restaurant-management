import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds created_at to table_session_food_status_counts and teaches the sync
 * trigger to maintain it, so every status-counts API response carries a
 * "since when" alongside updated_at.
 *
 * Derived as MIN(order_items.created_at) for the group rather than stamped
 * with now() on first insert: the trigger re-aggregates the whole group on
 * every touch, so a clock stamp would be rewritten on each change and the
 * value would mean nothing. Taken from the lines themselves it stays stable
 * and actually answers "how long has this food been in the pipeline" — which
 * is what a KDS ages tickets by.
 */
export class AddCreatedAtToFoodStatusCounts1781700000000
  implements MigrationInterface
{
  name = 'AddCreatedAtToFoodStatusCounts1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE table_session_food_status_counts
        ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      UPDATE table_session_food_status_counts c
      SET created_at = src.first_added
      FROM (
        SELECT order_id, food_id, food_variant_id, MIN(created_at) AS first_added
        FROM order_items
        GROUP BY order_id, food_id, food_variant_id
      ) src
      WHERE src.order_id = c.order_id
        AND src.food_id = c.food_id
        AND src.food_variant_id IS NOT DISTINCT FROM c.food_variant_id
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_table_session_food_status_counts()
      RETURNS trigger AS $$
      DECLARE
        k record;
      BEGIN
        FOR k IN
          SELECT DISTINCT order_id, food_id, food_variant_id FROM (
            SELECT NEW.order_id AS order_id, NEW.food_id AS food_id, NEW.food_variant_id AS food_variant_id
            WHERE TG_OP IN ('INSERT', 'UPDATE')
            UNION ALL
            SELECT OLD.order_id, OLD.food_id, OLD.food_variant_id
            WHERE TG_OP IN ('UPDATE', 'DELETE')
          ) keys
        LOOP
          INSERT INTO table_session_food_status_counts (
            order_id, food_id, food_variant_id, table_session_id,
            reserved_count, ordered_count, preparing_count, ready_count,
            served_count, cancelled_count, created_at, updated_at
          )
          SELECT
            k.order_id,
            k.food_id,
            k.food_variant_id,
            MAX(oi.table_session_id),
            COALESCE(SUM(oi.quantity) FILTER (WHERE oi.status = 'stock_reserved'), 0),
            COALESCE(SUM(oi.quantity) FILTER (WHERE oi.status = 'sent_to_kitchen'), 0),
            COALESCE(SUM(oi.quantity) FILTER (WHERE oi.status = 'preparing'), 0),
            COALESCE(SUM(oi.quantity) FILTER (WHERE oi.status = 'ready'), 0),
            COALESCE(SUM(oi.quantity) FILTER (WHERE oi.status = 'served'), 0),
            COALESCE(SUM(oi.quantity) FILTER (WHERE oi.status = 'cancelled'), 0),
            MIN(oi.created_at),
            now()
          FROM order_items oi
          WHERE oi.order_id = k.order_id
            AND oi.food_id = k.food_id
            AND oi.food_variant_id IS NOT DISTINCT FROM k.food_variant_id
          HAVING COUNT(*) > 0
          ON CONFLICT (order_id, food_id, COALESCE(food_variant_id, -1)) DO UPDATE SET
            table_session_id = EXCLUDED.table_session_id,
            reserved_count = EXCLUDED.reserved_count,
            ordered_count = EXCLUDED.ordered_count,
            preparing_count = EXCLUDED.preparing_count,
            ready_count = EXCLUDED.ready_count,
            served_count = EXCLUDED.served_count,
            cancelled_count = EXCLUDED.cancelled_count,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at;

          -- Only when the underlying lines are physically gone. An all-zero
          -- row is meaningful here (everything on it was voided) and stays.
          DELETE FROM table_session_food_status_counts c
          WHERE c.order_id = k.order_id
            AND c.food_id = k.food_id
            AND c.food_variant_id IS NOT DISTINCT FROM k.food_variant_id
            AND NOT EXISTS (
              SELECT 1 FROM order_items oi
              WHERE oi.order_id = k.order_id
                AND oi.food_id = k.food_id
                AND oi.food_variant_id IS NOT DISTINCT FROM k.food_variant_id
            );
        END LOOP;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE table_session_food_status_counts
        DROP COLUMN IF EXISTS created_at
    `);
  }
}
