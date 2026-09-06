import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * CLI-only DataSource used by the TypeORM CLI (migration:generate/run/revert).
 * The running Nest app uses TypeOrmModule.forRootAsync in app.module.ts
 * instead — kept in sync manually since the CLI can't consume Nest DI.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_DATABASE ?? 'restaurant',
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  synchronize: false,
  entities: ['src/modules/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  // The Laravel schema already owns a "migrations" table (its own tracker,
  // incompatible schema) — TypeORM must track its own migrations elsewhere.
  migrationsTableName: 'typeorm_migrations',
});
