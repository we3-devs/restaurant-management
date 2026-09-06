import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

/**
 * Outlet-scoped, persisted notification feed (kitchen-ready pushes, service
 * requests, order events). Pushed to connected POS / waiter screens over the
 * KDS websocket and shown in the global header bell.
 */
export class CreateNotificationsTable1770300000000 implements MigrationInterface {
  name = 'CreateNotificationsTable1770300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'outlet_id', type: 'bigint', isNullable: false },
          { name: 'type', type: 'varchar', length: '255', isNullable: false },
          { name: 'title', type: 'varchar', length: '255', isNullable: false },
          { name: 'body', type: 'text', isNullable: true },
          {
            name: 'table_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'order_id', type: 'bigint', isNullable: true },
          { name: 'data', type: 'text', isNullable: true },
          { name: 'read_at', type: 'timestamp', isNullable: true },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        columnNames: ['outlet_id'],
        referencedTableName: 'outlets',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedTableName: 'orders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notifications', true);
  }
}
