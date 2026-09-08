import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueCustomerOutletLinks1779100000000 implements MigrationInterface {
  name = 'UniqueCustomerOutletLinks1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_outlets_customer_outlet ON customer_outlets(customer_id, outlet_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_customer_outlets_customer_outlet`);
  }
}
