import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssistantPermission1779200000000 implements MigrationInterface {
  name = 'AddAssistantPermission1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO permissions (name, slug, module, action, level, is_system, is_active, description)
      VALUES ('Use Operations Assistant', 'assistant.use', 'assistant', 'use', 'global', TRUE, TRUE, 'Allows viewing and using the operations assistant')
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
      DELETE FROM role_permissions
      WHERE permission_id = (SELECT id FROM permissions WHERE slug = 'assistant.use')
    `);
    await queryRunner.query(`DELETE FROM permissions WHERE slug = 'assistant.use'`);
  }
}
