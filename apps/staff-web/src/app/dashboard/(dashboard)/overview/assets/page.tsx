"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAssets } from "@/hooks/use-assets"
import { usePageTitle } from "@rms/ui/use-page-title"

const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function AssetsPage() {
  const { data: assets = [], isLoading } = useAssets()
  usePageTitle("Assets")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-lg font-semibold">Organization assets</h1><p className="text-sm text-muted-foreground">View the assets registered for this organization.</p></div>
        <Button render={<Link href="/dashboard/overview/assets/add" />}><Plus /> Add assets</Button>
      </div>
      <Card><CardHeader><CardTitle>Asset list</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading assets...</p> : assets.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No assets added yet.</p> : (
          <Table><TableHeader><TableRow><TableHead>Serial no.</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{assets.map((asset) => <TableRow key={asset.id}><TableCell>{asset.serialNo}</TableCell><TableCell>{asset.name}</TableCell><TableCell className="text-right">{asset.quantity}</TableCell><TableCell className="text-right">{money(asset.rate)}</TableCell><TableCell className="text-right font-medium">{money(asset.total)}</TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  )
}
