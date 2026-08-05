"use client"

import { useSyncExternalStore } from "react"

/** Tiny external store so the header search button and CommandPalette (rendered separately in the layout tree) can share open state without prop-drilling or a context provider. */
let isOpen = false
const listeners = new Set<() => void>()

function setCommandPaletteOpen(value: boolean | ((prev: boolean) => boolean)) {
  isOpen = typeof value === "function" ? value(isOpen) : value
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCommandPaletteOpen() {
  const open = useSyncExternalStore(subscribe, () => isOpen, () => false)
  return [open, setCommandPaletteOpen] as const
}
