"use client"

import { useEffect } from "react"

/** Registers the staff service worker for the desktop operational shell so
 * Web Push works on /pos, /kitchen, /orders, and other non-/staff routes. */
export function RegisterOperationalServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined)
  }, [])

  return null
}
