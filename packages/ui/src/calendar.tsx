"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "./cn"
import { Button } from "./button"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function buildMonthGrid(monthDate: Date) {
  const firstOfMonth = startOfMonth(monthDate)
  const startWeekday = firstOfMonth.getDay()
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(gridStart.getDate() - startWeekday)

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + i)
    return day
  })
}

interface CalendarProps {
  selected?: Date
  onSelect?: (date: Date) => void
  month?: Date
  onMonthChange?: (date: Date) => void
  disabled?: (date: Date) => boolean
  className?: string
}

function Calendar({ selected, onSelect, month, onMonthChange, disabled, className }: CalendarProps) {
  const [internalMonth, setInternalMonth] = React.useState(() => startOfMonth(selected ?? new Date()))
  const viewMonth = month ?? internalMonth
  const today = new Date()

  function setMonth(next: Date) {
    setInternalMonth(next)
    onMonthChange?.(next)
  }

  const days = React.useMemo(() => buildMonthGrid(viewMonth), [viewMonth])

  return (
    <div data-slot="calendar" className={cn("w-64", className)}>
      <div className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="text-sm font-medium">
          {viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-xs font-medium text-muted-foreground">
            {day}
          </span>
        ))}
        {days.map((day) => {
          const outsideMonth = day.getMonth() !== viewMonth.getMonth()
          const isSelected = selected && isSameDay(day, selected)
          const isToday = isSameDay(day, today)
          const isDisabled = disabled?.(day) ?? false
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect?.(day)}
              className={cn(
                "mx-auto flex size-8 items-center justify-center rounded-md text-sm transition-colors",
                outsideMonth && "text-muted-foreground/50",
                !outsideMonth && !isSelected && "text-foreground hover:bg-muted",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                isToday && !isSelected && "font-semibold text-primary",
                isDisabled && "pointer-events-none opacity-30",
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { Calendar }
