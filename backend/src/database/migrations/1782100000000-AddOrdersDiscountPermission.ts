import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrdersDiscountPermission1782100000000
  implements MigrationInterface
{
  name = 'AddOrdersDiscountPermission1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO permissions (name, slug, module, action, level, is_system, is_active, description)
      VALUES ('Apply Order Discount', 'orders.discount', 'orders', 'discount', 'global', TRUE, TRUE, 'Allows applying or changing a discount on an order')
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        module = EXCLUDED.module,
        action = EXCLUDED.action,
        is_active = TRUE,
        description = EXCLUDED.description
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM position_permissions
      WHERE permission_id = (SELECT id FROM permissions WHERE slug = 'orders.discount')
    `);
    await queryRunner.query(`DELETE FROM permissions WHERE slug = 'orders.discount'`);
  }
}
