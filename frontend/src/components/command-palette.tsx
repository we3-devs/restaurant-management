"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { useCurrentUser } from "@/lib/auth/current-user-context"
import { useCommandPaletteOpen } from "@/hooks/use-command-palette"
import { visibleNavGroups } from "@/app/(dashboard)/nav-items"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export function CommandPalette() {
  const router = useRouter()
  const { permissions, isSuperadmin } = useCurrentUser()
  const [open, setOpen] = useCommandPaletteOpen()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const groups = useMemo(() => visibleNavGroups(permissions, isSuperadmin), [permissions, isSuperadmin])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups
      .map((group) => ({
        ...group,
        links: q ? group.links.filter((link) => link.label.toLowerCase().includes(q)) : group.links,
      }))
      .filter((group) => group.links.length > 0)
  }, [groups, query])

  const flatLinks = useMemo(() => results.flatMap((group) => group.links), [results])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flatLinks.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const link = flatLinks[activeIndex]
      if (link) navigate(link.href)
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        ref={inputRef}
        placeholder="Jump to a page..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onInputKeyDown}
      />
      <CommandList>
        {flatLinks.length === 0 && <CommandEmpty>No results found.</CommandEmpty>}
        {results.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.links.map((link) => {
              const index = flatLinks.indexOf(link)
              return (
                <CommandItem
                  key={link.href}
                  active={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => navigate(link.href)}
                >
                  {link.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
