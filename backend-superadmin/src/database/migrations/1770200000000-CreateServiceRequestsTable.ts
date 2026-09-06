import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Guest/staff service requests ("Need Water", "Need Bill", "Need Assistance").
 * Requested by a guest through the QR page or by staff on the guest's behalf;
 * resolved by waitstaff from the Service screen.
 */
export class CreateServiceRequestsTable1770200000000 implements MigrationInterface {
  name = 'CreateServiceRequestsTable1770200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'service_requests',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'outlet_id', type: 'bigint', isNullable: false },
          { name: 'dining_table_id', type: 'bigint', isNullable: false },
          { name: 'type', type: 'varchar', length: '255', isNullable: false },
          { name: 'note', type: 'text', isNullable: true },
          {
            name: 'status',
            type: 'varchar',
            length: '255',
            default: "'pending'",
          },
          {
            name: 'requested_by',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'resolved_by',
            type: 'bigint',
            isNullable: true,
          },
          { name: 'resolved_at', type: 'timestamp', isNullable: true },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'service_requests',
      new TableForeignKey({
        columnNames: ['outlet_id'],
        referencedTableName: 'outlets',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'service_requests',
      new TableForeignKey({
        columnNames: ['dining_table_id'],
        referencedTableName: 'dining_tables',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'service_requests',
      new TableForeignKey({
        columnNames: ['requested_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'service_requests',
      new TableForeignKey({
        columnNames: ['resolved_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // The service queue drains by (outlet, status) — the waiter dashboard
    // filters on this constantly.
    await queryRunner.createIndex(
      'service_requests',
      new TableIndex({
        name: 'IDX_service_requests_outlet_status',
        columnNames: ['outlet_id', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('service_requests', true);
  }
}
