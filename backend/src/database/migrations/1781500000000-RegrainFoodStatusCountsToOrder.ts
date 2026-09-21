import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Re-grains table_session_food_status_counts from (food, table session) to
 * (order, food, variant) so it can serve as the one place every order's
 * kitchen progress is read from.
 *
 * The old grain couldn't hold that: several orders on one session collapsed
 * into a single row (no way to ask "where is order #123"), the two variants
 * of a food merged even though the KDS routes them separately, grab-and-go
 * orders produced no row at all, and cart-stage items were invisible.
 *
 * Changes from the original shape:
 *  - order_id joins the key; table_session_id becomes a plain nullable
 *    column (null = grab-and-go/takeaway), so every order gets rows.
 *  - food_variant_id joins the key, using the same COALESCE(...,-1)
 *    sentinel idx_order_items_merge_key already uses for "no variant".
 *  - reserved_count carries the cart stage (status='stock_reserved'),
 *    which used to be excluded outright.
 *  - a row now survives at all-zero and is removed only once its underlying
 *    order_items rows are gone, so "ordered then fully voided" stays
 *    distinguishable from "never ordered".
 */
export class RegrainFoodStatusCountsToOrder1781500000000
  implements MigrationInterface
{
  name = 'RegrainFoodStatusCountsToOrder1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_sync_table_session_food_status_counts ON order_items`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS sync_table_session_food_status_counts()`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS table_session_food_status_counts`,
    );

    // Surrogate id rather than a composite PK: the natural key needs
    // COALESCE on the nullable food_variant_id, which a PK can't express.
    await queryRunner.query(`
      CREATE TABLE table_session_food_status_counts (
        id bigserial PRIMARY KEY,
        order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        food_id bigint NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
        food_variant_id bigint REFERENCES food_variants(id) ON DELETE CASCADE,
        table_session_id bigint REFERENCES table_sessions(id) ON DELETE SET NULL,
        reserved_count numeric(12,2) NOT NULL DEFAULT 0,
        ordered_count numeric(12,2) NOT NULL DEFAULT 0,
        preparing_count numeric(12,2) NOT NULL DEFAULT 0,
        ready_count numeric(12,2) NOT NULL DEFAULT 0,
        served_count numeric(12,2) NOT NULL DEFAULT 0,
        cancelled_count numeric(12,2) NOT NULL DEFAULT 0,
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_food_status_counts_key
        ON table_session_food_status_counts (
          order_id, food_id, COALESCE(food_variant_id, -1)
        )
    `);

    // Per-table reads ("what does this table have in the kitchen") are now a
    // rollup across the session's orders rather than a direct row hit.
    await queryRunner.query(`
      CREATE INDEX idx_food_status_counts_session
        ON table_session_food_status_counts (table_session_id)
        WHERE table_session_id IS NOT NULL
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
            served_count, cancelled_count, updated_at
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

    await queryRunner.query(`
      CREATE TRIGGER trg_sync_table_session_food_status_counts
      AFTER INSERT OR UPDATE OR DELETE ON order_items
      FOR EACH ROW EXECUTE FUNCTION sync_table_session_food_status_counts()
    `);

    await queryRunner.query(`
      INSERT INTO table_session_food_status_counts (
        order_id, food_id, food_variant_id, table_session_id,
        reserved_count, ordered_count, preparing_count, ready_count,
        served_count, cancelled_count, updated_at
      )
      SELECT
        order_id,
        food_id,
        food_variant_id,
        MAX(table_session_id),
        COALESCE(SUM(quantity) FILTER (WHERE status = 'stock_reserved'), 0),
        COALESCE(SUM(quantity) FILTER (WHERE status = 'sent_to_kitchen'), 0),
        COALESCE(SUM(quantity) FILTER (WHERE status = 'preparing'), 0),
        COALESCE(SUM(quantity) FILTER (WHERE status = 'ready'), 0),
        COALESCE(SUM(quantity) FILTER (WHERE status = 'served'), 0),
        COALESCE(SUM(quantity) FILTER (WHERE status = 'cancelled'), 0),
        now()
      FROM order_items
      GROUP BY order_id, food_id, food_variant_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_sync_table_session_food_status_counts ON order_items`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS sync_table_session_food_status_counts()`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS table_session_food_status_counts`,
    );
  }
}
