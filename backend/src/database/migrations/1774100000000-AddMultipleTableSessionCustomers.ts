import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultipleTableSessionCustomers1774100000000 implements MigrationInterface {
  name = 'AddMultipleTableSessionCustomers1774100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE table_session_customers (
        table_session_id BIGINT NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
        customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        PRIMARY KEY (table_session_id, customer_id)
      )
    `);
    await queryRunner.query(`
      INSERT INTO table_session_customers (table_session_id, customer_id)
      SELECT id, customer_id FROM table_sessions WHERE customer_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE order_customers (
        order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        PRIMARY KEY (order_id, customer_id)
      )
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION copy_table_session_customers_to_order()
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO order_customers (order_id, customer_id)
        SELECT NEW.id, tsc.customer_id FROM table_session_customers tsc
        WHERE tsc.table_session_id = NEW.table_session_id ON CONFLICT DO NOTHING;
        IF NEW.customer_id IS NOT NULL THEN
          INSERT INTO order_customers (order_id, customer_id) VALUES (NEW.id, NEW.customer_id) ON CONFLICT DO NOTHING;
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      INSERT INTO order_customers (order_id, customer_id)
      SELECT id, customer_id FROM orders WHERE customer_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO order_customers (order_id, customer_id)
      SELECT o.id, tsc.customer_id FROM orders o
      JOIN table_session_customers tsc ON tsc.table_session_id = o.table_session_id
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      CREATE TRIGGER orders_copy_table_session_customers
      AFTER INSERT ON orders FOR EACH ROW
      EXECUTE FUNCTION copy_table_session_customers_to_order()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS orders_copy_table_session_customers ON orders`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS copy_table_session_customers_to_order()`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_customers`);
    await queryRunner.query(`DROP TABLE IF EXISTS table_session_customers`);
  }
}
