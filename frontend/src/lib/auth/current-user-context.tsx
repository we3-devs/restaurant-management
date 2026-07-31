"use client"

import { createContext, useContext } from "react"
import type { CurrentUser } from "./dal"

export type { CurrentUser }

const CurrentUserContext = createContext<CurrentUser | null>(null)

/**
 * Seeded once by the dashboard layout with the user it already fetched via
 * getCurrentUser() (the real, server-verified /auth/me call). Everything
 * below the layout reads from this instead of re-fetching — the layout is
 * the only place in the tree that hits the network for the current user.
 */
export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser
  children: React.ReactNode
}) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>
}

export function useCurrentUser(): CurrentUser {
  const user = useContext(CurrentUserContext)
  if (!user) {
    throw new Error("useCurrentUser must be used within the dashboard layout's CurrentUserProvider")
  }
  return user
}
