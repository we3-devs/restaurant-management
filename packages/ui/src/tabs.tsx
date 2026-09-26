"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "./cn"

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative inline-flex h-9 w-fit items-center gap-4 border-b border-border text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex h-9 items-center justify-center gap-1.5 px-0.5 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors select-none hover:text-foreground data-selected:text-foreground disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function TabsIndicator({ className, ...props }: TabsPrimitive.Indicator.Props) {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      className={cn(
        "absolute bottom-0 left-0 z-0 h-[2px] w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-foreground transition-all duration-200 ease-in-out",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("mt-3 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger }
