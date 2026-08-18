import { cn } from "./cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "rounded-md bg-muted",
        "bg-[linear-gradient(90deg,var(--muted)_0%,var(--skeleton-highlight)_50%,var(--muted)_100%)]",
        "bg-[length:200%_100%] animate-skeleton",
        "motion-reduce:animate-none motion-reduce:bg-none motion-reduce:bg-muted",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
