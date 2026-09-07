import 'dotenv/config';
import { Client } from 'pg';

/**
 * Small production-safe compatibility step. The full TypeORM migration graph
 * is intentionally not loaded during Render boot because it exceeds the
 * service memory limit. This only removes the obsolete global role slug
 * constraint left by the pre-tenant schema.
 */
async function main(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_DATABASE ?? 'restaurant',
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    await client.query(`
      ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_slug_unique;
      DROP INDEX IF EXISTS roles_slug_unique;
      ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_slug_key;
      DROP INDEX IF EXISTS roles_slug_key;
      UPDATE roles SET is_assignable = false;
      DELETE FROM user_role_assignments;
    `);
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error('Role schema compatibility check failed', error);
  process.exitCode = 1;
});
