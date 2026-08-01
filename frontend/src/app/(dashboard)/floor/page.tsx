"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActiveOutlet } from "@/lib/outlet/active-outlet-context"
import { FloorBoard } from "./floor-board"

export default function FloorPage() {
  const { outletId, setOutletId, outlets, showOutletPicker } = useActiveOutlet()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Floor</h1>
        {showOutletPicker && (
          <div className="w-56">
            <Select
              value={outletId ? String(outletId) : ""}
              onValueChange={(value) => setOutletId(value ? Number(value) : null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets.map((outlet) => (
                  <SelectItem key={outlet.id} value={String(outlet.id)}>
                    {outlet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {outletId ? (
        <FloorBoard outletId={outletId} />
      ) : (
        <p className="text-sm text-muted-foreground">Select an outlet.</p>
      )}
    </div>
  )
}
