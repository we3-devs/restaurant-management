import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ensures both warehouse ends of a stock transfer belong to one tenant. */
export class EnforceStockTransferTenantConsistency1777500000000
  implements MigrationInterface
{
  name = 'EnforceStockTransferTenantConsistency1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
            FROM ingredient_stock_transfers t
            LEFT JOIN warehouses source_warehouse
              ON source_warehouse.id = t.from_warehouse_id
            LEFT JOIN warehouses destination_warehouse
              ON destination_warehouse.id = t.to_warehouse_id
           WHERE source_warehouse.id IS NULL
              OR destination_warehouse.id IS NULL
              OR source_warehouse.tenant_id IS NULL
              OR destination_warehouse.tenant_id IS NULL
              OR source_warehouse.tenant_id <> destination_warehouse.tenant_id
        ) THEN
          RAISE EXCEPTION 'Existing stock transfer has warehouses from different tenants or missing warehouse ownership';
        END IF;
      END
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_stock_transfer_tenant_id()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        source_tenant_id BIGINT;
        destination_tenant_id BIGINT;
      BEGIN
        SELECT tenant_id INTO source_tenant_id
          FROM warehouses WHERE id = NEW.from_warehouse_id;
        SELECT tenant_id INTO destination_tenant_id
          FROM warehouses WHERE id = NEW.to_warehouse_id;

        IF source_tenant_id IS NULL OR destination_tenant_id IS NULL THEN
          RAISE EXCEPTION 'Both stock-transfer warehouses must exist and belong to a tenant';
        END IF;

        IF source_tenant_id <> destination_tenant_id THEN
          RAISE EXCEPTION 'Stock-transfer warehouses must belong to the same tenant';
        END IF;

        NEW.tenant_id := source_tenant_id;
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS stock_transfers_same_tenant_trigger
      ON ingredient_stock_transfers
    `);
    await queryRunner.query(`
      CREATE TRIGGER stock_transfers_same_tenant_trigger
      BEFORE INSERT OR UPDATE OF from_warehouse_id, to_warehouse_id
      ON ingredient_stock_transfers
      FOR EACH ROW
      EXECUTE FUNCTION set_stock_transfer_tenant_id()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS stock_transfers_same_tenant_trigger
      ON ingredient_stock_transfers
    `);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_stock_transfer_tenant_id()`);
  }
}
