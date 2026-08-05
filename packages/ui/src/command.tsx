"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"

import { cn } from "./cn"
import { Dialog, DialogContent } from "./dialog"

function CommandDialog({
  className,
  children,
  open,
  onOpenChange,
}: React.ComponentProps<typeof Dialog> & { className?: string; children?: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn("max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg", className)}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
      <input
        data-slot="command-input"
        className={cn(
          "h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-list"
      className={cn("max-h-80 overflow-y-auto overflow-x-hidden p-1", className)}
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CommandGroup({
  heading,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { heading?: string }) {
  return (
    <div data-slot="command-group" className={cn("py-1", className)} {...props}>
      {heading && (
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{heading}</div>
      )}
      {children}
    </div>
  )
}

function CommandItem({
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-slot="command-item"
      data-active={active || undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none select-none",
        "data-active:bg-primary/10 data-active:text-primary hover:bg-muted hover:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

export { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem }
