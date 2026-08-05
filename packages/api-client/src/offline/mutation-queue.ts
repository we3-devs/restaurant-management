"use client"

import { useEffect, useState } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { apiClient, ApiError } from "../client"
import { queryKeys } from "../query-keys"
import { getOfflineDb, type QueuedMutation } from "./db"

const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export async function queueMutation(entry: Omit<QueuedMutation, "id" | "createdAt">) {
  const db = getOfflineDb()
  if (!db) return
  const queued: QueuedMutation = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }
  await (await db).add("mutation-queue", queued)
  notifyListeners()
}

export async function getQueuedMutationCount() {
  const db = getOfflineDb()
  if (!db) return 0
  return (await db).count("mutation-queue")
}

/**
 * Replays queued mutations in the order they were queued. Stops at the first
 * failure and leaves it (and everything after it) in the queue — a mid-queue
 * failure could mean genuinely still offline (retry later) or a real server
 * rejection, and dropping user data silently is worse than leaving it queued
 * for a manual look.
 */
export async function replayQueuedMutations(queryClient?: QueryClient) {
  const db = getOfflineDb()
  if (!db) return
  const store = await db
  const all = await store.getAll("mutation-queue")
  const sorted = all.sort((a, b) => a.createdAt - b.createdAt)
  let replayedAny = false

  for (const entry of sorted) {
    try {
      await apiClient(entry.path, {
        method: entry.method,
        body: entry.body !== undefined ? JSON.stringify(entry.body) : undefined,
      })
      await store.delete("mutation-queue", entry.id)
      replayedAny = true
      notifyListeners()
    } catch (error) {
      // Action-style endpoints (kitchen ticket start/mark-ready/mark-served,
      // item status transitions) throw a 400 if the request actually reached
      // the server before its response was lost — the action already
      // applied, so the ticket/item is already past this transition. That's
      // convergence, not failure: drop the entry and keep draining instead
      // of leaving it (and everything queued after it) stuck forever.
      if (entry.convergentOnBadRequest && error instanceof ApiError && error.status === 400) {
        await store.delete("mutation-queue", entry.id)
        replayedAny = true
        notifyListeners()
        continue
      }
      // Otherwise: still offline, or a genuine server rejection. Leave this
      // and later entries queued for the next reconnect attempt.
      break
    }
  }

  // The optimistic cache updates that queued these mutations may have raced
  // React Query's own paused-fetch resume on reconnect. One explicit
  // invalidation after a successful drain guarantees the UI reflects the
  // server's final state instead of relying on that ordering.
  if (replayedAny) {
    queryClient?.invalidateQueries({ queryKey: queryKeys.orders.all })
    queryClient?.invalidateQueries({ queryKey: queryKeys.kitchenTickets.all })
  }
}

export function useQueuedMutationCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    function refresh() {
      getQueuedMutationCount().then((n) => {
        if (!cancelled) setCount(n)
      })
    }
    refresh()
    listeners.add(refresh)
    return () => {
      cancelled = true
      listeners.delete(refresh)
    }
  }, [])

  return count
}
