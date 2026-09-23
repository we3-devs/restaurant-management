const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * Relative luminance (WCAG). Used to decide whether text on the brand colour
 * should be white or black — a brand yellow with white text is unreadable, and
 * the shipped --primary-foreground is hardcoded white.
 */
function luminance(hex: string): number {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/**
 * Admins can pick any brand colour with no regard for which theme it lands on —
 * a dark navy brand colour used as a flat fill (chart rings, status dots)
 * disappears against the dark theme's near-black surfaces, and a pale/white
 * brand colour does the same against the light theme's near-white surfaces.
 * Rather than partially blending (which still reads as murky at the extremes),
 * swap straight to white or black once the brand colour is too close to the
 * current theme's own background to read as a distinct fill.
 */
function ensureVisibleOnSurface(color: string, isDark: boolean): string {
  const lum = luminance(color)
  if (isDark && lum < 0.12) return "#ffffff"
  if (!isDark && lum > 0.88) return "#111827"
  return color
}

/**
 * Paints the admin's brand colour onto the theme's CSS custom properties.
 *
 * Set on documentElement.style rather than in a stylesheet so it outranks both
 * `:root` and `.dark` in globals.css without needing a second dark-mode value —
 * inline styles beat class selectors, so one brand colour covers both themes.
 *
 * Shades are derived with color-mix() rather than JS colour maths: the browser
 * interpolates in oklab, which keeps tints perceptually even.
 */
export function applyBrandColor(color: string | null | undefined, isDark = false): void {
  if (typeof document === "undefined") return

  const root = document.documentElement
  const vars = [
    "--primary",
    "--primary-foreground",
    "--color-brand-50",
    "--color-brand-100",
    "--color-brand-600",
    "--color-brand-700",
    "--color-brand-800",
  ]

  if (!color || !HEX.test(color)) {
    // Unset rather than write a default, so the stylesheet's own light/dark
    // values take over again.
    for (const name of vars) root.style.removeProperty(name)
    return
  }

  const displayColor = ensureVisibleOnSurface(color, isDark)
  root.style.setProperty("--primary", displayColor)
  root.style.setProperty(
    "--primary-foreground",
    luminance(displayColor) > 0.55 ? "#111827" : "#ffffff",
  )

  // guest-web's palette (see its globals.css @theme block).
  root.style.setProperty("--color-brand-50", `color-mix(in oklab, ${color} 10%, white)`)
  root.style.setProperty("--color-brand-100", `color-mix(in oklab, ${color} 20%, white)`)
  root.style.setProperty("--color-brand-600", color)
  root.style.setProperty("--color-brand-700", `color-mix(in oklab, ${color} 85%, black)`)
  root.style.setProperty("--color-brand-800", `color-mix(in oklab, ${color} 70%, black)`)
}
