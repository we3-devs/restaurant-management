import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateKitchenTicketsTables1769900000000 implements MigrationInterface {
  name = 'CreateKitchenTicketsTables1769900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'kitchen_tickets',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'order_id', type: 'bigint', isNullable: false },
          { name: 'outlet_id', type: 'bigint', isNullable: false },
          { name: 'department_id', type: 'bigint', isNullable: true },
          {
            name: 'status',
            type: 'varchar',
            length: '255',
            default: "'open'",
          },
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

    await queryRunner.createTable(
      new Table({
        name: 'kitchen_ticket_items',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'ticket_id', type: 'bigint', isNullable: false },
          { name: 'order_item_id', type: 'bigint', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '255',
            default: "'sent_to_kitchen'",
          },
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
      'kitchen_tickets',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedTableName: 'orders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'kitchen_tickets',
      new TableForeignKey({
        columnNames: ['outlet_id'],
        referencedTableName: 'outlets',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'kitchen_tickets',
      new TableForeignKey({
        columnNames: ['department_id'],
        referencedTableName: 'outlet_departments',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'kitchen_ticket_items',
      new TableForeignKey({
        columnNames: ['ticket_id'],
        referencedTableName: 'kitchen_tickets',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'kitchen_ticket_items',
      new TableForeignKey({
        columnNames: ['order_item_id'],
        referencedTableName: 'order_items',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('kitchen_ticket_items', true);
    await queryRunner.dropTable('kitchen_tickets', true);
  }
}
