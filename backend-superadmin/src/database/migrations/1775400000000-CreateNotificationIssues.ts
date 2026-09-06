import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateNotificationIssues1775400000000 implements MigrationInterface {
  name = 'CreateNotificationIssues1775400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'notification_issues',
      columns: [
        { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'outlet_id', type: 'bigint', isNullable: false },
        { name: 'notification_type', type: 'varchar', length: '255' },
        { name: 'title', type: 'varchar', length: '255' },
        { name: 'reason', type: 'text' },
        { name: 'policy_version_id', type: 'bigint', isNullable: true },
        { name: 'notification_id', type: 'bigint', isNullable: true },
        { name: 'status', type: 'varchar', length: '20', default: "'unresolved'" },
        { name: 'metadata', type: 'jsonb', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'now()' },
        { name: 'updated_at', type: 'timestamp', default: 'now()' },
      ],
    }));
    await queryRunner.createForeignKey('notification_issues', new TableForeignKey({
      columnNames: ['outlet_id'], referencedTableName: 'outlets', referencedColumnNames: ['id'], onDelete: 'CASCADE',
    }));
    await queryRunner.createForeignKey('notification_issues', new TableForeignKey({
      columnNames: ['notification_id'], referencedTableName: 'notifications', referencedColumnNames: ['id'], onDelete: 'SET NULL',
    }));
    await queryRunner.createIndex('notification_issues', new TableIndex({
      name: 'IDX_notification_issues_status_outlet', columnNames: ['status', 'outlet_id'],
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notification_issues', true);
  }
}
