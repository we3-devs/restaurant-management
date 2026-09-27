/**
 * The signed-in user this tab's offline data belongs to. Staff tablets are
 * shared, so the persisted query cache and the offline mutation queue are
 * scoped to this user: one person's cached screens or unsynced writes must
 * never surface — or replay — under the next person's login. Set by
 * QueryProvider before any of its children render.
 */
let offlineOwner: number | null = null

export function setOfflineOwner(userId: number | null): void {
  offlineOwner = userId
}

export function getOfflineOwner(): number | null {
  return offlineOwner
}

/**
 * Deletes the service worker's cached API responses (the rms-api-* caches in
 * public/sw.js). The worker can't tell users apart, so this runs on every
 * login and logout instead.
 */
export async function clearCachedApiResponses(): Promise<void> {
  if (typeof caches === "undefined") return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith("rms-api-")).map((key) => caches.delete(key)))
  } catch {
    // Storage unavailable (private mode, blocked site data) — nothing was cached.
  }
}
