"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Anti-flicker loading gate for client-side data fetching.
 *
 * Returns false for the first `delay` ms of a load, so fast/cached responses
 * never flash a placeholder. Once it flips true it stays true for at least
 * `minDuration` ms even if the data lands immediately after, so a slow
 * response never strobes between placeholder and content.
 *
 * Swap `isLoading` for this at call sites:
 *
 *   const { data, isLoading } = useCustomers({ ... })
 *   const showSkeleton = useDelayedLoading(isLoading)
 */
export function useDelayedLoading(
  isLoading: boolean,
  { delay = 200, minDuration = 400 }: { delay?: number; minDuration?: number } = {},
): boolean {
  const [show, setShow] = useState(false)
  const shownAtRef = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  function clearTimers() {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
  }

  useEffect(() => {
    clearTimers()

    if (!isLoading) {
      if (shownAtRef.current > 0) {
        // Keep showing until minDuration has elapsed since it first appeared.
        const remaining = minDuration - (Date.now() - shownAtRef.current)
        if (remaining > 0) {
          const t = setTimeout(() => {
            shownAtRef.current = 0
            setShow(false)
          }, remaining)
          timersRef.current.push(t)
        } else {
          shownAtRef.current = 0
          setShow(false)
        }
      } else {
        setShow(false)
      }
      return
    }

    // Loading just started — wait out the delay before showing anything.
    const t = setTimeout(() => {
      shownAtRef.current = Date.now()
      setShow(true)
    }, delay)
    timersRef.current.push(t)
  }, [isLoading, delay, minDuration])

  // Clean up any pending timers on unmount.
  useEffect(() => () => clearTimers(), [])

  return show
}
