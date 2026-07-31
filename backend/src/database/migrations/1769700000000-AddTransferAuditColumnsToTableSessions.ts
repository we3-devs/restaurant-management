import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddTransferAuditColumnsToTableSessions1769700000000 implements MigrationInterface {
  name = 'AddTransferAuditColumnsToTableSessions1769700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('table_sessions', [
      new TableColumn({
        name: 'transferred_by',
        type: 'bigint',
        isNullable: true,
      }),
      new TableColumn({
        name: 'transferred_at',
        type: 'timestamp',
        isNullable: true,
      }),
    ]);

    await queryRunner.createForeignKey(
      'table_sessions',
      new TableForeignKey({
        columnNames: ['transferred_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('table_sessions');
    const foreignKey = table?.foreignKeys.find((fk) =>
      fk.columnNames.includes('transferred_by'),
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('table_sessions', foreignKey);
    }
    await queryRunner.dropColumns('table_sessions', [
      'transferred_by',
      'transferred_at',
    ]);
  }
}
