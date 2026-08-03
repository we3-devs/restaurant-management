"use client"

import { useEffect, useState } from "react"
import { DownloadIcon, RefreshCwIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const VISIT_COUNT_KEY = "staff-pwa-visit-count"
const INSTALL_DISMISSED_KEY = "staff-pwa-install-dismissed"
const MIN_VISITS_BEFORE_PROMPT = 3

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own standalone flag — not covered by the media query above.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Registers the single shared service worker (public/sw.js — also used by
 * Web Push, see push-subscribe.ts) for the staff PWA, and surfaces a
 * deferred install prompt only once the visitor looks like returning staff
 * (not on first load) and hasn't already dismissed it or installed.
 */
export function RegisterStaffServiceWorker() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  // Lazy initializer, not an effect — this only ever needs to reflect
  // localStorage as it was when the component first mounted on the client.
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(INSTALL_DISMISSED_KEY) === "1",
  )

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // sw.js's own install handler calls skipWaiting() unconditionally, so
        // a newer worker becomes active on its own — this just tells the
        // *already-open* tab a fresh one landed, since the JS already
        // running in memory doesn't swap itself out without a reload. Only
        // fires for a genuine update (registration.active already existed);
        // the very first install on a device is not "available", it's just installing.
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing
          if (!installing || !registration.active) return
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") setUpdateAvailable(true)
          })
        })
      })
      .catch(() => {
        // Non-fatal — push notifications and offline caching just won't be available this session.
      })

    if (isStandalone() || dismissed) return
    const visits = Number(localStorage.getItem(VISIT_COUNT_KEY) ?? "0") + 1
    localStorage.setItem(VISIT_COUNT_KEY, String(visits))

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      if (visits >= MIN_VISITS_BEFORE_PROMPT) {
        setInstallEvent(event as BeforeInstallPromptEvent)
      }
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
  }, [dismissed])

  async function handleInstall() {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  function handleDismiss() {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1")
    setDismissed(true)
  }

  if (updateAvailable) {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-primary/10 px-3 py-2 text-sm">
        <RefreshCwIcon className="size-4 shrink-0 text-primary" />
        <p className="flex-1">A new version is ready.</p>
        <Button size="sm" className="h-9" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    )
  }

  if (!installEvent || dismissed) return null

  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-2 text-sm">
      <DownloadIcon className="size-4 shrink-0 text-primary" />
      <p className="flex-1">Install this app for quicker access and offline support.</p>
      <Button size="sm" className="h-9" onClick={handleInstall}>
        Install
      </Button>
      <Button size="icon" variant="ghost" className="size-9" onClick={handleDismiss} aria-label="Dismiss install prompt">
        <XIcon />
      </Button>
    </div>
  )
}
