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

    // The table may already exist when the database was restored from a schema
    // dump. In that case createTable(..., true) skips the table, but the
    // foreign key still needs to be checked before attempting to add it.
    const refreshTokensTable = await queryRunner.getTable('refresh_tokens');
    const hasUserForeignKey = refreshTokensTable?.foreignKeys.some(
      (foreignKey) =>
        foreignKey.columnNames.length === 1 &&
        foreignKey.columnNames[0] === 'user_id' &&
        foreignKey.referencedTableName === 'users' &&
        foreignKey.referencedColumnNames.length === 1 &&
        foreignKey.referencedColumnNames[0] === 'id',
    );

    if (!hasUserForeignKey) {
      await queryRunner.createForeignKey(
        'refresh_tokens',
        new TableForeignKey({
          name: 'FK_3ddc983c5f7bcf132fd8732c3f4',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('refresh_tokens');
  }
}
