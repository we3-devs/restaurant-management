import type { EntityManager } from 'typeorm';

/**
 * Whether an admin has deactivated this account. Deactivating a user marks
 * every employee record linked to it inactive (UsersService.deactivate), so
 * that is what this checks. Accounts with no employee records at all (e.g. a
 * tenant owner) are never treated as deactivated, and neither is any account
 * whose employee rows the query can't see — it fails open rather than
 * locking someone out.
 */
export async function isAccountDeactivated(
  manager: EntityManager,
  userId: number,
): Promise<boolean> {
  const rows: Array<{ deactivated: boolean }> = await manager.query(
    `SELECT EXISTS (SELECT 1 FROM employees WHERE user_id = $1)
        AND NOT EXISTS (
          SELECT 1 FROM employees WHERE user_id = $1 AND is_active = true
        ) AS deactivated`,
    [userId],
  );
  return rows[0]?.deactivated === true;
}
