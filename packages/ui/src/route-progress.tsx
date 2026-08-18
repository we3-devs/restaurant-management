"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import { cn } from "./cn"

/**
 * Fixed 2px top progress bar giving every navigation immediate feedback,
 * including programmatic router.push/replace (heavily used in the POS and
 * table-row onClicks) and plain <a> clicks, which Next's own indicators
 * don't cover.
 *
 * Start: capture-phase document click on a same-origin a[href] to a different
 * path, plus patched history.pushState/replaceState (Next Link internally
 * calls router.push, which lands here — start() is idempotent so the
 * double-fire is a no-op).
 * Finish: usePathname() changing. Deliberately not useSearchParams() — that
 * would force a CSR bailout on any page rendering this without a Suspense
 * boundary.
 *
 * Mount once per app in the root layout.
 */
export function RouteProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevPathnameRef = useRef(pathname)
  const reduceMotionRef = useRef(false)

  function clearTimers() {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
  }

  function start() {
    // Idempotent — a Link click fires both the capture listener and the
    // patched history.pushState for the same navigation.
    if (rafRef.current !== null) return
    clearTimers()
    setActive(true)

    if (reduceMotionRef.current) {
      // Static indeterminate bar — no sweeping animation under reduced motion.
      setProgress(80)
      return
    }

    let p = 0
    setProgress(0)
    const tick = () => {
      // Ease out toward 80% so it never stalls at a visible constant.
      p = p + (80 - p) * 0.06
      if (p >= 79.5) {
        rafRef.current = null
        setProgress(80)
        return
      }
      setProgress(p)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function finish() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setProgress(100)
    const t = setTimeout(() => {
      setActive(false)
      setProgress(0)
    }, 250)
    timersRef.current.push(t)
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    reduceMotionRef.current = mq.matches
    const onChange = (e: MediaQueryListEvent) => {
      reduceMotionRef.current = e.matches
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    function isSameOriginDifferentPath(href: string) {
      try {
        const url = new URL(href, window.location.href)
        return (
          url.origin === window.location.origin &&
          url.pathname + url.search !== window.location.pathname + window.location.search
        )
      } catch {
        return false
      }
    }

    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return
      const target = e.target as HTMLElement
      const anchor = target.closest?.("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (
        !href ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("#")
      )
        return
      if (isSameOriginDifferentPath(href)) start()
    }

    const originalPush = history.pushState
    const originalReplace = history.replaceState
    history.pushState = function patchedPush(...args) {
      const result = originalPush.apply(this, args)
      start()
      return result
    }
    history.replaceState = function patchedReplace(...args) {
      const result = originalReplace.apply(this, args)
      start()
      return result
    }

    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      history.pushState = originalPush
      history.replaceState = originalReplace
    }
  }, [])

  // Finish when the route actually changes.
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname
      finish()
    }
  }, [pathname])

  // Safety reset — never leave a stuck bar up for longer than 10s.
  useEffect(() => {
    if (!active) return
    const t = setTimeout(finish, 10_000)
    return () => clearTimeout(t)
  }, [active])

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 bg-primary transition-opacity duration-200",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
    </div>
  )
}
