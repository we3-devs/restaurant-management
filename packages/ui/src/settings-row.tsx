import type { ComponentProps, ComponentType, ReactNode } from "react"
import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "./cn"
import { Card } from "./card"

type IconType = ComponentType<{ className?: string }>

interface SettingsRowBaseProps {
  icon?: IconType
  label: string
  description?: string
  trailing?: ReactNode
  destructive?: boolean
  disabled?: boolean
  className?: string
}

type SettingsRowProps =
  | (SettingsRowBaseProps & { href: string; onClick?: never })
  | (SettingsRowBaseProps & { href?: never; onClick: () => void })
  | (SettingsRowBaseProps & { href?: never; onClick?: never })

/** One row in a settings/profile list — icon, label (+ optional description), and a trailing element (chevron by default when interactive, or a custom node like a Switch or value). Renders as a Link, a button, or a static div depending on which of href/onClick is passed. */
function SettingsRow({
  icon: Icon,
  label,
  description,
  trailing,
  destructive,
  disabled,
  href,
  onClick,
  className,
}: SettingsRowProps) {
  const interactive = Boolean((href || onClick) && !disabled)

  const content = (
    <>
      {Icon && (
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            destructive ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium", destructive && "text-destructive")}>{label}</span>
        {description && <span className="block truncate text-xs text-muted-foreground">{description}</span>}
      </span>
      {trailing ?? (interactive && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />)}
    </>
  )

  const rowClass = cn(
    "flex w-full items-center gap-3 px-4 py-3 text-left",
    interactive && "transition-colors hover:bg-muted/50",
    disabled && "opacity-50",
    className
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    )
  }

  if (onClick && !disabled) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {content}
      </button>
    )
  }

  return <div className={rowClass}>{content}</div>
}

/** Card wrapper for a stack of SettingsRows, with a hairline divider between each — the "grouped list" pattern used by profile/settings screens. */
function SettingsRowGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <Card
      className={cn("gap-0 divide-y divide-border rounded-2xl border-border/60 p-0 shadow-none", className)}
      {...props}
    />
  )
}

export { SettingsRow, SettingsRowGroup }
