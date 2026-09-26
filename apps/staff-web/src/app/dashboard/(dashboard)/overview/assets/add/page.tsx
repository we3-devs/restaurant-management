"use client"

import Link from "next/link"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAssets, useCreateAssets, useDeleteAsset, type CreateAssetItemInput } from "@/hooks/use-assets"
import { toast } from "sonner"
import { usePageTitle } from "@rms/ui/use-page-title"

const blank = (): CreateAssetItemInput => ({ serialNo: "", name: "", quantity: 1, rate: 0 })

export default function AddAssetsPage() {
  const [items, setItems] = useState<CreateAssetItemInput[]>([blank()])
  const { data: assets = [] } = useAssets()
  const createAssets = useCreateAssets()
  const deleteAsset = useDeleteAsset()
  usePageTitle("Add assets")

  function update(index: number, field: keyof CreateAssetItemInput, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === "quantity" || field === "rate" ? Number(value) : value } : item))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (items.some((item) => !item.serialNo.trim() || !item.name.trim() || item.quantity < 1 || item.rate <= 0)) {
      toast.error("Complete every asset row with a valid quantity and rate")
      return
    }
    try {
      await createAssets.mutateAsync(items)
      toast.success(`${items.length} asset${items.length === 1 ? "" : "s"} added`)
      setItems([blank()])
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to add assets") }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3"><div><h1 className="text-lg font-semibold">Add assets</h1><p className="text-sm text-muted-foreground">Add multiple asset items in one submission.</p></div><Button variant="outline" render={<Link href="/dashboard/overview/assets" />}><ArrowLeft /> View assets</Button></div>
      <form onSubmit={submit}><Card><CardHeader><CardTitle>Asset items</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="hidden grid-cols-[1fr_2fr_110px_140px_140px_36px] gap-2 text-xs font-medium text-muted-foreground md:grid"><span>Serial no.</span><span>Name</span><span>Quantity</span><span>Rate</span><span>Total</span><span /></div>
        {items.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_2fr_110px_140px_140px_36px] md:border-0 md:p-0"><Input aria-label="Serial number" placeholder="Serial no." value={item.serialNo} onChange={(event) => update(index, "serialNo", event.target.value)} required /><Input aria-label="Name" placeholder="Asset name" value={item.name} onChange={(event) => update(index, "name", event.target.value)} required /><Input aria-label="Quantity" type="number" min="1" step="1" value={item.quantity} onChange={(event) => update(index, "quantity", event.target.value)} required /><Input aria-label="Rate" type="number" min="0.01" step="0.01" value={item.rate || ""} onChange={(event) => update(index, "rate", event.target.value)} required /><Input aria-label="Total" value={(item.quantity * item.rate).toFixed(2)} readOnly /><Button type="button" variant="ghost" size="icon" aria-label="Remove item" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button></div>)}
        <div className="flex flex-wrap justify-between gap-2"><Button type="button" variant="outline" onClick={() => setItems((current) => [...current, blank()])}><Plus /> Add another row</Button><Button type="submit" disabled={createAssets.isPending}>{createAssets.isPending ? "Saving..." : "Save assets"}</Button></div>
      </CardContent></Card></form>
      <Card><CardHeader><CardTitle>Manage existing assets</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        {assets.length === 0 ? <p className="text-sm text-muted-foreground">No assets added yet.</p> : <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Serial no.</th><th className="p-2">Name</th><th className="p-2 text-right">Quantity</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Action</th></tr></thead><tbody>{assets.map((asset) => <tr className="border-b" key={asset.id}><td className="p-2">{asset.serialNo}</td><td className="p-2">{asset.name}</td><td className="p-2 text-right">{asset.quantity}</td><td className="p-2 text-right">{asset.total.toFixed(2)}</td><td className="p-2 text-right"><Button type="button" variant="destructive" size="sm" disabled={deleteAsset.isPending} onClick={() => { if (window.confirm(`Remove ${asset.name}?`)) void deleteAsset.mutateAsync(asset.id) }}>Remove</Button></td></tr>)}</tbody></table>}
      </CardContent></Card>
    </div>
  )
}
