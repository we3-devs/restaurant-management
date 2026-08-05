"use client"

import { SearchIcon } from "lucide-react"

import { useCommandPaletteOpen } from "@/hooks/use-command-palette"

/** Visible trigger for the existing Cmd/Ctrl+K command palette — the palette itself only had a hidden keyboard shortcut before, with no discoverable UI entry point. */
export function HeaderSearchButton() {
  const [, setOpen] = useCommandPaletteOpen()

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted sm:w-56 lg:w-64"
    >
      <SearchIcon className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search...</span>
      <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
        ⌘K
      </kbd>
    </button>
  )
}
