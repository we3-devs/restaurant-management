"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export function QueryProvider({ children }: { children: React.ReactNode }) {
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
            // live (active orders, table sessions).
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
