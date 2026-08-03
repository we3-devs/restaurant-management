import { openDB, type DBSchema, type IDBPDatabase } from "idb"

export interface QueuedMutation {
  id: string
  path: string
  method: string
  body: unknown
  label: string
  createdAt: number
  /**
   * Set for action-style endpoints (e.g. kitchen ticket start/mark-ready)
   * that aren't a plain absolute-value PATCH: replaying them after they've
   * already applied throws a 400 ("no eligible items") instead of a no-op.
   * When true, a 400 on replay is treated as "already converged" and the
   * entry is dropped instead of blocking the rest of the queue.
   */
  convergentOnBadRequest?: boolean
}

interface OfflineDB extends DBSchema {
  "mutation-queue": {
    key: string
    value: QueuedMutation
  }
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null

export function getOfflineDb() {
  if (typeof indexedDB === "undefined") return null
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>("rms-offline-queue", 1, {
      upgrade(db) {
        db.createObjectStore("mutation-queue", { keyPath: "id" })
      },
    })
  }
  return dbPromise
}
