"use client"

import { useEffect, useState } from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useOutlets } from "@/hooks/use-outlets"
import { FloorBoard } from "./floor-board"

const OUTLET_STORAGE_KEY = "floor-outlet-id"

function readStoredOutletId(): number | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(OUTLET_STORAGE_KEY)
  return stored ? Number(stored) : null
}

export default function FloorPage() {
  const { data: outlets } = useOutlets({ limit: 100 })
  const [outletId, setOutletId] = useState<number | null>(() => readStoredOutletId())
  const effectiveOutletId = outletId ?? outlets?.data[0]?.id ?? null

  useEffect(() => {
    if (effectiveOutletId) localStorage.setItem(OUTLET_STORAGE_KEY, String(effectiveOutletId))
  }, [effectiveOutletId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Floor</h1>
        <div className="w-56">
          <Select
            value={effectiveOutletId ? String(effectiveOutletId) : ""}
            onValueChange={(value) => setOutletId(value ? Number(value) : null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an outlet" />
            </SelectTrigger>
            <SelectContent>
              {outlets?.data.map((outlet) => (
                <SelectItem key={outlet.id} value={String(outlet.id)}>
                  {outlet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {effectiveOutletId ? (
        <FloorBoard outletId={effectiveOutletId} />
      ) : (
        <p className="text-sm text-muted-foreground">Select an outlet.</p>
      )}
    </div>
  )
}
