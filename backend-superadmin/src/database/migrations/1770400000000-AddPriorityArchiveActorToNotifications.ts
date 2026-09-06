import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddPriorityArchiveActorToNotifications1770400000000 implements MigrationInterface {
  name = 'AddPriorityArchiveActorToNotifications1770400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('notifications', [
      new TableColumn({
        name: 'priority',
        type: 'varchar',
        length: '20',
        default: "'normal'",
      }),
      new TableColumn({
        name: 'archived_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'actor_user_id',
        type: 'bigint',
        isNullable: true,
      }),
    ]);

    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        columnNames: ['actor_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('notifications');
    const fk = table?.foreignKeys.find((fk) =>
      fk.columnNames.includes('actor_user_id'),
    );
    if (fk) {
      await queryRunner.dropForeignKey('notifications', fk);
    }
    await queryRunner.dropColumns('notifications', [
      'priority',
      'archived_at',
      'actor_user_id',
    ]);
  }
}
