import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSettingsAndAuditLogsTables1771000000000 implements MigrationInterface {
  name = 'CreateSettingsAndAuditLogsTables1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Global Settings
    await queryRunner.query(`
      CREATE TABLE global_settings (
        id BIGSERIAL PRIMARY KEY,
        category VARCHAR(50) UNIQUE NOT NULL CHECK (category IN ('business','pos','kitchen','inventory','reservation','loyalty','notification','appearance')),
        data JSONB NOT NULL DEFAULT '{}',
        updated_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Audit Logs
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL CHECK (action IN ('login','logout','create','update','delete','approve','reject','payment','refund','inventory_movement','purchase_approval','reservation_change','settings_change','role_change','permission_change','order_change','kitchen_status_change')),
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100),
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(64),
        user_agent VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
      CREATE INDEX idx_audit_logs_action ON audit_logs(action);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS global_settings CASCADE`);
  }
}
