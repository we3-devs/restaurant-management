"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps } from "react"

// next-themes renders its no-flash init script as a literal <script> element,
// which this Next/React version warns about on client re-renders (see
// node_modules/next/dist/docs/.../preventing-flash-before-hydration.md).
// scriptProps is next-themes' supported hook for exactly this: giving the
// script type="text/javascript" server-side (so it still runs during HTML
// parsing on hard loads, before hydration) and type="text/plain" client-side
// (so React no longer treats it as an executable script tag it rendered).
const noFlashScriptProps = {
  type: typeof window === "undefined" ? "text/javascript" : "text/plain",
}

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider scriptProps={noFlashScriptProps} {...props}>
      {children}
    </NextThemesProvider>
  )
}
