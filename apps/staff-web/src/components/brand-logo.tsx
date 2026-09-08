"use client"

import { useState } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

/**
 * The tenant's logo when branding provides one, else an initials tile. The
 * tile colours itself from currentColor (`bg-current/10`), so it works on both
 * the white card (text-foreground) and the brand-coloured sidebar
 * (text-primary-foreground) without per-context variants.
 */
export function BrandLogo({
  logoUrl,
  name,
  className,
}: {
  logoUrl?: string | null
  name: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("")

  if (logoUrl && !failed) {
    return (
      <span className={cn("relative inline-flex shrink-0 overflow-hidden rounded-lg", className)}>
        <Image
          src={logoUrl}
          alt=""
          fill
          unoptimized
          className="object-contain"
          onError={() => setFailed(true)}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-current/10 font-semibold tracking-wide uppercase",
        className
      )}
    >
      {initials}
    </span>
  )
}
