import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateRefreshTokensTable1769600000000 implements MigrationInterface {
  name = 'CreateRefreshTokensTable1769600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          { name: 'id', type: 'bigserial', isPrimary: true },
          { name: 'user_id', type: 'bigint' },
          {
            name: 'token_hash',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          { name: 'expires_at', type: 'timestamp' },
          { name: 'revoked_at', type: 'timestamp', isNullable: true },
          {
            name: 'replaced_by_token_hash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'refresh_tokens',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('refresh_tokens');
  }
}
