"use client"

import { useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { restoreQueryCache, subscribeQueryCachePersistence } from "./offline/query-persister"

export function QueryProvider({
  children,
  persist = false,
}: {
  children: React.ReactNode
  /**
   * Offline-first mode: durably persists the whole query cache to IndexedDB
   * (survives reloads/offline) and stops treating time alone as a reason to
   * refetch — realtime invalidation (see realtime-invalidation-provider.tsx)
   * becomes the thing that marks data stale, not a staleTime clock. Only the
   * staff PWA (operational-web) opts into this; dashboard-web keeps the
   * plain in-memory, time-based cache.
   */
  persist?: boolean
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data younger than this is served from cache with no network
            // call — kills the refetch-on-mount/refocus duplication that
            // otherwise happens every time a component remounts or the
            // window regains focus. Individual hooks override this where
            // data is either near-static (reference tables) or must stay
            // live (active orders, table sessions). In persist mode there's
            // no clock at all — realtime invalidation is the only thing
            // that marks a query stale.
            staleTime: persist ? Infinity : 30_000,
            // In persist mode this must outlive the debounce window between
            // saves (and ideally never evict at all) — the whole point is
            // that hydrated data survives until something invalidates it.
            gcTime: persist ? Infinity : 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
            // Only meaningful in persist mode: a realtime invalidation that
            // arrived while offline needs the reconnect to actually trigger
            // the refetch, since nothing else will.
            refetchOnReconnect: persist,
            refetchOnMount: true,
            networkMode: "online",
          },
          mutations: {
            // Never silently retry a write — duplicate POSTs/PATCHes are
            // worse than surfacing the failure once to the caller.
            retry: 0,
            networkMode: "online",
          },
        },
      }),
  )

  const [isRestored, setIsRestored] = useState(!persist)

  useEffect(() => {
    if (!persist) return
    let cancelled = false
    void restoreQueryCache(queryClient).finally(() => {
      if (!cancelled) setIsRestored(true)
    })
    const unsubscribe = subscribeQueryCachePersistence(queryClient)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [persist, queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {isRestored ? children : null}
    </QueryClientProvider>
  )
}
