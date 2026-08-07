import type { QueryClient } from "@tanstack/react-query"
import { dehydrate, hydrate } from "@tanstack/react-query"
import { getOfflineDb } from "./db"

const CACHE_KEY = "react-query-cache"
const PERSIST_DEBOUNCE_MS = 1000
/** Bump when the shape of persisted data changes in a way hydrate() couldn't handle against old entries. */
const CACHE_BUSTER = 1

interface PersistedCache {
  buster: number
  savedAt: number
  state: unknown
}

async function saveQueryCache(client: QueryClient): Promise<void> {
  const db = await getOfflineDb()
  if (!db) return
  // Mutations aren't dehydrated — the offline mutation queue (mutation-queue.ts)
  // already owns replaying pending writes; resurrecting mutation state here
  // would just duplicate/conflict with that.
  const state = dehydrate(client, { shouldDehydrateMutation: () => false })
  const payload: PersistedCache = { buster: CACHE_BUSTER, savedAt: Date.now(), state }
  await db.put("query-cache", payload, CACHE_KEY)
}

/** Restores the last-persisted query cache into `client`, if present and not stale. Resolves once hydration is complete (or immediately if there was nothing to restore). */
export async function restoreQueryCache(client: QueryClient, maxAgeMs = 24 * 60 * 60_000): Promise<void> {
  const db = await getOfflineDb()
  if (!db) return
  const payload = (await db.get("query-cache", CACHE_KEY)) as PersistedCache | undefined
  if (!payload || payload.buster !== CACHE_BUSTER) return
  if (Date.now() - payload.savedAt > maxAgeMs) return
  hydrate(client, payload.state)
}

/** Saves the query cache to IndexedDB on every change, debounced. Pairs with restoreQueryCache() — this is the ongoing "keep it saved" half of the durable cache. */
export function subscribeQueryCachePersistence(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void saveQueryCache(client), PERSIST_DEBOUNCE_MS)
  }

  const unsubscribe = client.getQueryCache().subscribe(schedule)

  return () => {
    if (timer) clearTimeout(timer)
    unsubscribe()
  }
}
