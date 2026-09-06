import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPriorityTimersRecallToKitchenTickets1770000000000 implements MigrationInterface {
  name = 'AddPriorityTimersRecallToKitchenTickets1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('kitchen_tickets', [
      new TableColumn({
        name: 'priority',
        type: 'varchar',
        length: '20',
        default: "'normal'",
      }),
      new TableColumn({
        name: 'started_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'ready_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'served_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'recalled_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'recall_count',
        type: 'int',
        default: 0,
      }),
    ]);

    await queryRunner.addColumns('kitchen_ticket_items', [
      new TableColumn({
        name: 'started_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'ready_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'served_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'recalled_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'recall_count',
        type: 'int',
        default: 0,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('kitchen_ticket_items', [
      'started_at',
      'ready_at',
      'served_at',
      'recalled_at',
      'recall_count',
    ]);
    await queryRunner.dropColumns('kitchen_tickets', [
      'priority',
      'started_at',
      'ready_at',
      'served_at',
      'recalled_at',
      'recall_count',
    ]);
  }
}
