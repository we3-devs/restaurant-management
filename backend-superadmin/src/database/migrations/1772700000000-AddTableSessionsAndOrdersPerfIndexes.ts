import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * table_sessions and orders shipped with no indexes beyond their primary
 * keys. POS table loading hits table_sessions filtered by dining_table_id
 * (+status) and outlet_id (+status) on every table tap, and orders filtered
 * by table_session_id right after — both were full sequential scans, which
 * is where the ~4.2s table-sessions / ~900ms orders response times came
 * from as those tables grew.
 */
export class AddTableSessionsAndOrdersPerfIndexes1772700000000
  implements MigrationInterface
{
  name = 'AddTableSessionsAndOrdersPerfIndexes1772700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'table_sessions',
      new TableIndex({
        name: 'IDX_table_sessions_dining_table_id',
        columnNames: ['dining_table_id'],
      }),
    );
    await queryRunner.createIndex(
      'table_sessions',
      new TableIndex({
        name: 'IDX_table_sessions_outlet_id',
        columnNames: ['outlet_id'],
      }),
    );
    await queryRunner.createIndex(
      'table_sessions',
      new TableIndex({
        name: 'IDX_table_sessions_status',
        columnNames: ['status'],
      }),
    );
    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'IDX_orders_table_session_id',
        columnNames: ['table_session_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('orders', 'IDX_orders_table_session_id');
    await queryRunner.dropIndex('table_sessions', 'IDX_table_sessions_status');
    await queryRunner.dropIndex('table_sessions', 'IDX_table_sessions_outlet_id');
    await queryRunner.dropIndex(
      'table_sessions',
      'IDX_table_sessions_dining_table_id',
    );
  }
}
