"use client"

import { useEffect, useState } from "react"

export function useOnlineStatus() {
  // `typeof navigator === "undefined"` doesn't reliably detect SSR — Node 21+
  // ships a partial global `navigator` with no `onLine` support, so that
  // check never trips server-side and `navigator.onLine` evaluates to
  // `undefined` there, mismatching the client's real value on hydration.
  // `window` is never polyfilled server-side, so it's the reliable check.
  const [isOnline, setIsOnline] = useState(() => (typeof window === "undefined" ? true : navigator.onLine))

  useEffect(() => {
    function goOnline() {
      setIsOnline(true)
    }
    function goOffline() {
      setIsOnline(false)
    }
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])

  return isOnline
}
