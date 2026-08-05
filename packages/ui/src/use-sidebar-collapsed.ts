"use client"

import { useEffect, useSyncExternalStore } from "react"

const STORAGE_KEY = "sidebar-collapsed"

let collapsed = false
let hydrated = false
const listeners = new Set<() => void>()

function setSidebarCollapsed(value: boolean | ((prev: boolean) => boolean)) {
  collapsed = typeof value === "function" ? value(collapsed) : value
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0")
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return collapsed
}

// Server (and the client's very first render, pre-hydration) always sees
// "expanded" — the real stored preference is only read once, from an effect
// below, so the client's first paint matches what the server sent.
function getServerSnapshot() {
  return false
}

/** Remembers the sidebar's collapsed/expanded state across the app (and across reloads via localStorage) — mirrors the "remember sidebar state" rule in the design system doc. */
export function useSidebarCollapsed() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (hydrated) return
    hydrated = true
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "1" && !collapsed) {
      collapsed = true
      listeners.forEach((listener) => listener())
    }
  }, [])

  return [value, setSidebarCollapsed] as const
}
