import { apiClient } from "../client"
import { queueMutation } from "./mutation-queue"

/**
 * A real browser network failure (offline, DNS down, connection reset)
 * throws a bare TypeError from fetch(). A non-ok HTTP response instead
 * throws the custom Error apiClient constructs from the response body — so
 * TypeError is the signal that this was a connectivity problem, not a
 * server-side rejection.
 */
function isNetworkFailure(error: unknown) {
  return error instanceof TypeError
}

/**
 * Drop-in replacement for apiClient used only by mutations that are safe to
 * replay blindly (convergent PATCH/DELETE — see use-orders.ts). If the
 * device is offline, or the request fails with a network error, the
 * mutation is persisted to IndexedDB instead of thrown, so the caller's
 * onSuccess/optimistic-update path still runs and the queue drains next
 * time the app comes back online.
 */
export async function queuableApiClient<T>(
  path: string,
  init: RequestInit & { method: string },
  label: string,
  options: { convergentOnBadRequest?: boolean } = {},
): Promise<T> {
  const offline = typeof navigator !== "undefined" && !navigator.onLine

  if (!offline) {
    try {
      return await apiClient<T>(path, init)
    } catch (error) {
      if (!isNetworkFailure(error)) throw error
    }
  }

  await queueMutation({
    path,
    method: init.method,
    body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    label,
    convergentOnBadRequest: options.convergentOnBadRequest,
  })
  return undefined as T
}
