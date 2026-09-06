import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerPortalFields1771200000000
  implements MigrationInterface
{
  name = 'AddCustomerPortalFields1771200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customers ADD COLUMN dietary_preferences JSONB;
      ALTER TABLE customers ADD COLUMN allergies JSONB;
      ALTER TABLE customers ADD COLUMN favorite_food_ids JSONB;
      ALTER TABLE customers ADD COLUMN addresses JSONB;
      ALTER TABLE customers ADD COLUMN last_login_at TIMESTAMP;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customers DROP COLUMN IF EXISTS dietary_preferences;
      ALTER TABLE customers DROP COLUMN IF EXISTS allergies;
      ALTER TABLE customers DROP COLUMN IF EXISTS favorite_food_ids;
      ALTER TABLE customers DROP COLUMN IF EXISTS addresses;
      ALTER TABLE customers DROP COLUMN IF EXISTS last_login_at;
    `);
  }
}
