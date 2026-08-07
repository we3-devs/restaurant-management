"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { MoonIcon } from "lucide-react"

import { SettingsRow } from "./settings-row"
import { Switch } from "./switch"

/** "Dark mode" row for profile/settings lists — a SettingsRow with a Switch trailing element, wired to next-themes. Mirrors ThemeToggle's hydration guard (server can't know the stored/system theme, so the switch starts disabled until mounted). */
export function DarkModeRow() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <SettingsRow
      icon={MoonIcon}
      label="Dark mode"
      trailing={
        <Switch
          checked={isDark}
          disabled={!mounted}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          aria-label="Toggle dark mode"
        />
      }
    />
  )
}
