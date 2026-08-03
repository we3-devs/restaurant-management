"use client"

import { useEffect, useState } from "react"
import { DownloadIcon, XIcon } from "lucide-react"

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
  // Lazy initializer, not an effect — this only ever needs to reflect
  // localStorage as it was when the component first mounted on the client.
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(INSTALL_DISMISSED_KEY) === "1",
  )

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {
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

  if (!installEvent || dismissed) return null

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
