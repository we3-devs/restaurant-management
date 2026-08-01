import { openDB, type DBSchema, type IDBPDatabase } from "idb"

export interface QueuedMutation {
  id: string
  path: string
  method: string
  body: unknown
  label: string
  createdAt: number
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
