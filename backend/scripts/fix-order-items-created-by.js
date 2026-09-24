// One-off fix for production: adds order_items.created_by (+ FK) and marks
// AddCreatedByToOrderItems1782400000000 as applied in typeorm_migrations,
// matching typeorm/migrations/1782400000000-AddCreatedByToOrderItems.ts.
// Run with: node scripts/fix-order-items-created-by.js
// (uses backend/.env — point it at the target DB before running)
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);

async function main() {
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_DATABASE,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const fk = await client.query(
      "SELECT 1 FROM pg_constraint WHERE conname = 'order_items_created_by_fkey'",
    );
    const tracked = await client.query(
      "SELECT 1 FROM typeorm_migrations WHERE name = 'AddCreatedByToOrderItems1782400000000'",
    );
    if (fk.rows.length > 0 || tracked.rows.length > 0) {
      console.log('Already applied — nothing to do.');
      return;
    }

    await client.query('BEGIN');
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_by BIGINT');
    await client.query(
      'ALTER TABLE order_items ADD CONSTRAINT order_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
    );
    await client.query(
      "INSERT INTO typeorm_migrations (timestamp, name) VALUES ('1782400000000', 'AddCreatedByToOrderItems1782400000000')",
    );
    await client.query('COMMIT');
    console.log('OK: order_items.created_by + FK added, tracker row inserted.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('ERROR', error.message);
  process.exitCode = 1;
});
