import { useEffect, useRef } from "react"

/**
 * Keeps the screen awake while a kitchen display is on-screen — these tend
 * to sit propped up in a kitchen and going to sleep mid-shift is worse than
 * the battery cost. No-ops entirely on browsers without the Wake Lock API
 * (e.g. iOS Safari as of this writing) instead of throwing.
 */
export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return

    let cancelled = false

    async function acquire() {
      try {
        const sentinel = await navigator.wakeLock.request("screen")
        if (cancelled) {
          await sentinel.release()
          return
        }
        lockRef.current = sentinel
      } catch {
        // Denied (e.g. low battery mode, backgrounded tab) — not fatal, just no wake lock this session.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !lockRef.current) void acquire()
    }

    void acquire()
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [enabled])
}
