"use client";

import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";

/**
 * Local port of @rms/ui's skeleton system — guest-web deliberately has no
 * @rms/ui dependency, so these mirror the shared shimmer primitive and the
 * CardGrid/List shapes the guest flow needs, using the slate palette already
 * in this app's design.
 */

function cn(...inputs: (string | false | null | undefined)[]) {
  return twMerge(inputs.filter(Boolean).join(" "));
}

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "rounded-md bg-slate-100",
        "bg-[linear-gradient(90deg,#F1F5F9_0%,#E2E8F0_50%,#F1F5F9_100%)]",
        "bg-[length:200%_100%] animate-skeleton",
        "motion-reduce:animate-none motion-reduce:bg-none motion-reduce:bg-slate-100",
        className
      )}
      {...props}
    />
  );
}

function SkeletonRegion({
  label = "Loading…",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

export function CardGridSkeleton({
  count = 4,
  columns,
  className,
}: {
  count?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <SkeletonRegion>
      <div
        className={cn("grid gap-3", className)}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex h-44 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <Skeleton className="h-24 w-full rounded-none border-0" />
            <div className="flex flex-1 flex-col gap-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="mt-auto flex items-center justify-between pt-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-6 w-16 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function ListSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <SkeletonRegion>
      <ul className={cn("space-y-2.5", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-16 shrink-0" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}

export function LoadingFallback({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

export default Skeleton;
