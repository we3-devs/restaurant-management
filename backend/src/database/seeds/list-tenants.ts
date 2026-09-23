import { AppDataSource } from '../data-source';

/**
 * Read-only lookup: prints tenant id/name/slug for tenants matching an
 * optional name/slug filter (or all tenants, if no filter is given). Use
 * this to find the exact --tenant-slug value for reset-tenant-sales-data.ts.
 *
 * Usage (run from backend/):
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/list-tenants.ts
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/list-tenants.ts atithi
 */

const filter = process.argv[2];

async function run() {
  await AppDataSource.initialize();
  const rows = filter
    ? await AppDataSource.query(
        `SELECT id, name, slug, is_active FROM tenants WHERE name ILIKE $1 OR slug ILIKE $1 ORDER BY id`,
        [`%${filter}%`],
      )
    : await AppDataSource.query(`SELECT id, name, slug, is_active FROM tenants ORDER BY id`);
  console.table(rows);
  await AppDataSource.destroy();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
