"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { MenuIcon } from "lucide-react"

import { Button } from "./button"

function setOpen(open: boolean) {
  document.getElementById("dashboard-sidebar")?.classList.toggle("-translate-x-full", !open)
  document.getElementById("dashboard-sidebar-backdrop")?.classList.toggle("hidden", !open)
}

/** Sidebar visibility lives in the DOM directly (see setOpen) since the sidebar and this toggle are siblings under a server component layout — no shared client state to lift it into. */
export function MobileNavToggle() {
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    const backdrop = document.getElementById("dashboard-sidebar-backdrop")
    const close = () => setOpen(false)
    backdrop?.addEventListener("click", close)
    return () => backdrop?.removeEventListener("click", close)
  }, [])

  function toggle() {
    const isOpen = !document.getElementById("dashboard-sidebar")?.classList.contains("-translate-x-full")
    setOpen(!isOpen)
  }

  return (
    <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Toggle navigation" onClick={toggle}>
      <MenuIcon />
    </Button>
  )
}
