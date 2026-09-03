import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPushSubscriptionApp1775500000000 implements MigrationInterface {
  name = 'AddPushSubscriptionApp1775500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('push_subscriptions', new TableColumn({
      name: 'app', type: 'varchar', length: '20', isNullable: true,
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('push_subscriptions', 'app');
  }
}
